import os
import glob
import subprocess
import sys

def install(package):
    subprocess.check_call([sys.executable, "-m", "pip", "install", package])

try:
    import pypdf
except ImportError:
    install('pypdf')
    import pypdf

os.makedirs('docs/sni/extracted', exist_ok=True)
pdfs = glob.glob('docs/sni/*.pdf')

for pdf_path in pdfs:
    name = os.path.basename(pdf_path)
    size = os.path.getsize(pdf_path)
    try:
        reader = pypdf.PdfReader(pdf_path)
        pages = len(reader.pages)
        
        extractable = False
        text_content = ""
        for i, page in enumerate(reader.pages):
            text = page.extract_text()
            if text and text.strip():
                extractable = True
            text_content += f"\n\n--- [Page {i+1}] ---\n\n"
            text_content += text if text else ""
            
        txt_name = os.path.splitext(name)[0] + ".txt"
        txt_path = os.path.join('docs/sni/extracted', txt_name)
        
        if extractable:
            with open(txt_path, 'w', encoding='utf-8') as f:
                f.write(text_content)
            print(f"OK: {name} | {pages} pages | {size} bytes | Extracted to {txt_name}")
        else:
            print(f"SCANNED: {name} | {pages} pages | {size} bytes | No text extracted")
            
    except Exception as e:
        print(f"ERROR reading {name}: {e}")

try:
    with open('.gitignore', 'r', encoding='utf-8') as f:
        content = f.read()
    if 'docs/sni/extracted/' not in content:
        with open('.gitignore', 'a', encoding='utf-8') as f:
            f.write('\ndocs/sni/extracted/\n')
except Exception as e:
    pass
