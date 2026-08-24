/**
 * Monta um CSS cursor a partir de um PNG grande (ex.: o ícone de tinta).
 * Reduz para 32×32 (limite típico do Windows) e escolhe o hotspot no pixel
 * opaco mais baixo — no balde, costuma ser o bico do derrame.
 *
 * @param {string} src
 * @param {{ invert?: boolean, size?: number }} [options]
 * @returns {Promise<string>} Valor de `cursor` (url(...) x y, fallback)
 */
export async function makeIconCursor(src, options = {}) {
  const size = options.size || 32
  const invert = Boolean(options.invert)
  const image = new Image()
  image.src = src
  await image.decode()

  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (invert) ctx.filter = 'brightness(0) invert(1)'
  ctx.drawImage(image, 0, 0, size, size)

  const { data } = ctx.getImageData(0, 0, size, size)
  let hotX = Math.floor(size / 2)
  let hotY = Math.floor(size / 2)
  let lowestY = -1
  let leftAtLowest = size

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      if (data[(y * size + x) * 4 + 3] < 20) continue
      if (y > lowestY || (y === lowestY && x < leftAtLowest)) {
        lowestY = y
        leftAtLowest = x
      }
    }
  }

  if (lowestY >= 0) {
    hotX = leftAtLowest
    hotY = lowestY
  }

  return `url("${canvas.toDataURL('image/png')}") ${hotX} ${hotY}, crosshair`
}
