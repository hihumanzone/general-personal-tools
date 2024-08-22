function splitCodesAndText(text) {
  const regex = /```[^```]{200,}```/g;
  const codeBlocks = text.match(regex) || [];
  const texts = text.split(regex);

  let result = [];
  texts.forEach((txt, index) => {
    if (txt.trim()) {
      result.push(txt);
    }
    if (index < codeBlocks.length && codeBlocks[index].trim()) {
      result.push(codeBlocks[index]);
    }
  });

  return result;
}

function processChunks(chunks) {
  function splitLargeChunk(chunk, delimiter) {
    const parts = chunk.split(delimiter);
    let processedParts = [];

    let currentPart = parts[0];
    for (let i = 1; i < parts.length; i++) {
      if ((currentPart + delimiter + parts[i]).length > 2000) {
        processedParts.push(currentPart);
        currentPart = parts[i];
      } else {
        currentPart += delimiter + parts[i];
      }
    }
    processedParts.push(currentPart);
    return processedParts;
  }

  const finalChunks = chunks.reduce((acc, chunk) => {
    if (chunk.length <= 2000) {
      if (chunk.trim()) {
        acc.push(chunk);
      }
    } else {
      const delimiters = ['\n', '. ', ' '];
      let splitSuccessful = false;

      for (const delimiter of delimiters) {
        const splitChunks = splitLargeChunk(chunk, delimiter);
        if (splitChunks.every(subChunk => subChunk.length <= 2000)) {
          splitChunks.forEach(splitChunk => {
            if (splitChunk.trim()) {
              acc.push(splitChunk);
            }
          });
          splitSuccessful = true;
          break;
        }
      }

      if (!splitSuccessful) {
        for (let pos = 0; pos < chunk.length; pos += 1950) {
          const part = chunk.slice(pos, pos + 1950);
          if (part.trim()) {
            acc.push(part);
          }
        }
      }
    }
    return acc;
  }, []);

  return finalChunks;
}

async function sendSplitMessage(message, botResponse) {
  const chunks = splitCodesAndText(botResponse).filter(chunk => chunk.trim());
  const processedChunks = processChunks(chunks).filter(chunk => chunk.trim());

  if (processedChunks.length > 0) {
    await message.reply(processedChunks[0]);
    for (let i = 1; i < processedChunks.length; i++) {
      await message.channel.send(processedChunks[i]);
    }
  }
}

module.exports = { sendSplitMessage };
// export { sendSplitMessage };
