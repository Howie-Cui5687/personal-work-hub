"""Stage the current user-approved reading result for static publication.

Run only after the user explicitly approves publication of this version.
Original EPUBs, models, caches and correction files remain outside public/.
"""
import argparse,json,pathlib,shutil
ROOT=pathlib.Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser()
parser.add_argument('--confirmed-publication',action='store_true',required=True)
parser.parse_args()
source=ROOT/'work/private-reading';target=ROOT/'public/reading'
catalog=json.loads((source/'local-catalog.json').read_text(encoding='utf-8'))
count=0
for item in catalog:
    name=item['id'];book=json.loads((source/f'{name}.json').read_text(encoding='utf-8'))
    for index,chapter in enumerate(book['chapters']):
        for filename in (chapter['file'],f'{name}-zh-{index}.json'):
            shutil.copyfile(source/filename,target/filename);count+=1
    book['license']='个人学习导入。英文为根据所提供中文生成的机器助读译文，并非英文原著。'
    (target/f'{name}.json').write_text(json.dumps(book,ensure_ascii=False),encoding='utf-8');count+=1
shutil.copyfile(source/'private-pronunciations.json',target/'private-pronunciations.json')
(target/'additional-books.json').write_text(json.dumps(catalog,ensure_ascii=False),encoding='utf-8')
print('Prepared',count+2,'approved reading files')
