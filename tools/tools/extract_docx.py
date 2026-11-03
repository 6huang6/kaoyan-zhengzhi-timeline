"""Extract plain text from .docx (paragraphs + tables) into a .txt corpus file."""
import sys
from docx import Document
from docx.table import Table
from docx.text.paragraph import Paragraph


def iter_block_items(parent):
    from docx.oxml.ns import qn
    body = parent.element.body
    for child in body.iterchildren():
        if child.tag == qn('w:p'):
            yield Paragraph(child, parent)
        elif child.tag == qn('w:tbl'):
            yield Table(child, parent)


def main(src, dst):
    doc = Document(src)
    lines = []
    for block in iter_block_items(doc):
        if isinstance(block, Paragraph):
            t = block.text.strip()
            if t:
                lines.append(t)
        else:
            for row in block.rows:
                cells = [c.text.strip().replace('\n', ' ') for c in row.cells]
                lines.append(' | '.join(cells))
    text = '\n'.join(lines)
    with open(dst, 'w', encoding='utf-8') as f:
        f.write(text)
    print(f'{src} -> {dst} chars={len(text)} lines={len(lines)}')


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
