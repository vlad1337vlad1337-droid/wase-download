import test from 'node:test';import assert from 'node:assert/strict';import {engineOrder} from '../backend/engine-order.mjs';
test('fallbacks use only declared engines, preserve stable priority and bound attempts',()=>{
 assert.deepEqual(engineOrder(['calibre','libreoffice','pandoc']),['libreoffice','pandoc','calibre']);
 assert.deepEqual(engineOrder(['imagemagick','graphicsmagick']),['imagemagick','graphicsmagick']);
 assert.deepEqual(engineOrder(['ffmpeg','vips','resvg','imaginary']),['resvg','vips','ffmpeg']);
 assert.deepEqual(engineOrder([]),[]);
});
test('raster-to-SVG retries its bounded pipeline once, without repeating identical fallbacks',()=>{
 for(const input of ['jpg','jpeg','jpe','png','bmp','gif','webp','tif','tiff','ico','avif','heic','heif','jxl']){
  assert.deepEqual(engineOrder(['imagemagick','vtracer','graphicsmagick'],input,'svg'),['vtracer'],input);
 }
 assert.deepEqual(engineOrder(['imagemagick'],'avif','svg'),['imagemagick']);
 assert.deepEqual(engineOrder(['imagemagick','vips'],'jpeg','png'),['vips','imagemagick']);
 assert.deepEqual(engineOrder(['imagemagick','inkscape'],'pdf','svg'),['imagemagick','inkscape']);
 assert.deepEqual(engineOrder([],'png','svg'),[]);
});
