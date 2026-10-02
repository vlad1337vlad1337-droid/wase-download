import { defineConfig } from 'vite';
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
function html(dir) { return readdirSync(dir, {withFileTypes:true}).flatMap(x => x.isDirectory() && x.name !== 'src' && x.name !== 'public' ? html(resolve(dir,x.name)) : x.isFile() && x.name.endsWith('.html') ? [resolve(dir,x.name)] : []); }
export default defineConfig({ root: 'site', publicDir:'public', server:{fs:{allow:[resolve('.')]},strictPort:true}, preview:{strictPort:true,proxy:{"/api":"http://127.0.0.1:5189"}}, build:{outDir:'../dist',emptyOutDir:true,rollupOptions:{input:html(resolve('site'))}} });
