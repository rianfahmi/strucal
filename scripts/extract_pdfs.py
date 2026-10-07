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

sni_dir = sys.argv[1] if len(sys.argv) > 1 else 'docs/sni'
output_dir = os.path.join(sni_dir, 'extracted')
os.makedirs(output_dir, exist_ok=True)
pdfs = glob.glob(os.path.join(sni_dir, '*.pdf'))

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
        txt_path = os.path.join(output_dir, txt_name)
        
        if extractable:
            with open(txt_path, 'w', encoding='utf-8') as f:
                f.write(text_content)
            print(f"OK: {name} | {pages} pages | {size} bytes | Extracted to {txt_name}")
        else:
            print(f"SCANNED: {name} | {pages} pages | {size} bytes | No text extracted")
            
    except Exception as e:
        print(f"ERROR reading {name}: {e}")
