export function buildClaudeMessage(mode, textInput, imageData) {
  switch (mode) {
    case 'text':
      return [
        {
          type: 'text',
          text: `Please decode this payslip: ${textInput}`,
        },
      ]

    case 'describe':
      return [
        {
          type: 'text',
          text: `The user has described their salary situation as follows:\n\n"${textInput}"\n\nBased on this description, decode their payslip, make reasonable assumptions where needed, and clearly state any assumptions you make.`,
        },
      ]

    case 'image':
      if (!imageData) throw new Error('No image data provided')
      return [
        {
          type: 'image',
          source: {
            type: 'base64',
            media_type: imageData.mediaType,
            data: imageData.base64,
          },
        },
        {
          type: 'text',
          text: 'Please decode the payslip shown in this image. Extract all earnings components, deductions, and calculate the take-home pay. If any numbers are unclear, state that explicitly.',
        },
      ]

    default:
      throw new Error(`Unknown input mode: ${mode}`)
  }
}
