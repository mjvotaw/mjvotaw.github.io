import * as fs from "fs";
import path from "path";

export function basename(path: string, ext?: string)
{
  let f = posixSplitPath(path)[2]
  if (ext && f.slice(-1 * ext.length) === ext) {
    f = f.slice(0, f.length - ext.length)
  }
  return f
}

export function dirname(path: string) {
  const result = posixSplitPath(path)
  const root = result[0]
  let dir = result[1]

  if (!root && !dir) return ""

  if (dir) dir = dir.slice(0, dir.length - 1)

  return root + dir
}

export function extname(path: string) {
  return posixSplitPath(path)[3]
}

const splitPathRe = /^(\/?|)([\s\S]*?)((?:\.{1,2}|[^/]+?|)(\.[^./]*|))(?:[/]*)$/

function posixSplitPath(filename: string) {
  return splitPathRe.exec(filename)!.slice(1)
}

export function findFilesWithExtension(baseDir: string, extension: string) 
{
  const files = fs.readdirSync(baseDir, { withFileTypes: true, recursive: true });
  
  let foundFiles: string[] = [];
  for (let file of files)
  {
    if (file.isFile())
    {
      let ext = extname(file.name);
      if (ext == extension)
      {
        foundFiles.push(path.join(file.parentPath, file.name));
      }
    }
  }
  return foundFiles;
}

export function saveToFile(data: string, filepath: string)
{
  let dir = dirname(filepath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filepath, data);
}

export function readJsonFromFile(filepath)
{
  let databuffer = fs.readFileSync(filepath);
  let json = JSON.parse(databuffer.toString());
  return json;
}