const priority=['vtracer','resvg','libheif','libjxl','vips','libreoffice','pandoc','calibre','ffmpeg','imagemagick','graphicsmagick'];
export function engineOrder(choices){return [...priority.filter(e=>choices.includes(e)),...choices.filter(e=>!priority.includes(e))].slice(0,3);}
