async function convertStructureForGemini(input) {
  async function convertContent(content) {
    const textPart = content.find(part => part.type === 'text');
    const newContent = await processPromptAndImageAttachmentsForGemini(textPart ? textPart.text : '', { attachments: new Map() });

    const imageParts = content.filter(part => part.type === 'image_url');
    if (imageParts.length > 0) {
      return await convertInputToExpectedFormatForGemini(content);
    }
    return newContent;
  }
  
  return await Promise.all(input.map(async entry => {
    const role = entry.role === 'user' ? 'user' : 'model';
    const parts = entry.content;

    let convertedParts;
    if (Array.isArray(parts)) {
      convertedParts = await convertContent(parts);
    } else {
      convertedParts = [{ text: parts }];
    }

    return {
      role: role,
      parts: convertedParts
    };
  }));
}

async function processPromptAndImageAttachmentsForGemini(prompt, message) {
  const attachments = Array.from(message.attachments.values());
  let parts = [{ text: prompt }];

  if (attachments.length > 0) {
    const imageAttachments = attachments.filter(attachment => attachment.contentType && attachment.contentType.startsWith('image/'));

    if (imageAttachments.length > 0) {
      const attachmentParts = await Promise.all(
        imageAttachments.map(async (attachment) => {
          const response = await fetch(attachment.url);
          const buffer = await response.arrayBuffer();
          let imageBuffer = Buffer.from(buffer);

          if (imageBuffer.length > 5 * 1024 * 1024) {
            imageBuffer = await sharp(imageBuffer)
              .resize(3072, 3072, {
                fit: sharp.fit.inside,
                withoutEnlargement: true
              })
              .jpeg({ quality: 80 })
              .toBuffer();

            if (imageBuffer.length > 5 * 1024 * 1024) {
              imageBuffer = await sharp(imageBuffer)
                .resize(2048, 2048, {
                  fit: sharp.fit.inside,
                  withoutEnlargement: true
                })
                .jpeg({ quality: 60 })
                .toBuffer();
            }
          }

          return {
            inlineData: {
              data: imageBuffer.toString('base64'),
              mimeType: attachment.contentType || 'application/octet-stream'
            }
          };
        })
      );
      parts = [...parts, ...attachmentParts];
    }
  }
  return parts;
}

async function convertInputToExpectedFormatForGemini(content) {
  const prompt = content.find(part => part.type === 'text')?.text || '';
  const imageUrls = content.filter(part => part.type === 'image_url').map(part => part.image_url);

  const message = {
    attachments: new Map(imageUrls.map((imageUrl, index) => {
      const parsedUrl = url.parse(imageUrl);
      const extension = path.extname(parsedUrl.pathname).replace(".", "") || 'jpeg';
      return [index, { url: imageUrl, contentType: `image/${extension}` }];
    }))
  };
  
  return processPromptAndImageAttachmentsForGemini(prompt, message);
}
