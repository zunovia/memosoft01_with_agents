// Parse [[wiki links]] and #tags from markdown content

export function extractWikiLinks(content: string): string[] {
  const re = /\[\[([^\]\n]+?)\]\]/g;
  const out = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(content))) {
    out.add(m[1].trim());
  }
  return [...out];
}

export function extractTags(content: string): string[] {
  const re = /(?:^|\s)#([\p{L}\p{N}_-]+)/gu;
  const out = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(content))) {
    out.add(m[1]);
  }
  return [...out];
}
