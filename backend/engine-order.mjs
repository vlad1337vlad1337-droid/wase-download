const priority=['vtracer','resvg','libheif','libjxl','vips','libreoffice','pandoc','calibre','ffmpeg','imagemagick','graphicsmagick'];
// Keep this in sync with engine.mjs: all of these SVG directions use the same
// bounded normalize/trace pipeline regardless of the original declared engine.
const tracedRaster=new Set(['jpg','jpeg','jpe','png','bmp','gif','webp','tif','tiff','ico','avif','heic','heif','jxl']);
export function engineOrder(choices,input,output){const order=[...priority.filter(e=>choices.includes(e)),...choices.filter(e=>!priority.includes(e))].slice(0,3);return output==='svg'&&tracedRaster.has(input)?order.slice(0,1):order;}
// CPU limits remain unchanged: slow vector tracing receives wall time, while
// other converter attempts retain the existing deadline. The broker's complete
// upload/queue/conversion/download deadline remains 180 seconds.
export function attemptTimeout(input,output){return output==='svg'&&tracedRaster.has(input)?150000:60000;}
