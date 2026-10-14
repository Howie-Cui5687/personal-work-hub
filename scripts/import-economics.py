"""Import licensed source books into portable, locally served reading data."""
import concurrent.futures, html, json, pathlib, re, urllib.request, time, base64, mimetypes
import xml.etree.ElementTree as ET

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / 'public' / 'reading'
OUT.mkdir(parents=True, exist_ok=True)
BASE = 'https://raw.githubusercontent.com/openstax/osbooks-principles-economics-bundle/main/'
NS = {'c': 'http://cnx.rice.edu/collxml', 'm': 'http://cnx.rice.edu/mdml', 'n': 'http://cnx.rice.edu/cnxml'}
def get(url):
    for attempt in range(4):
        try:
            with urllib.request.urlopen(url, timeout=60) as response: return response.read()
        except Exception:
            if attempt == 3: raise
            time.sleep(attempt + 1)
def text(el): return ''.join(el.itertext()).strip()
def render(el, module):
    tag = el.tag.split('}')[-1]
    if tag in ('metadata', 'mdml'): return ''
    if tag == 'image':
        src = el.get('src', '')
        url = BASE + 'media/' + pathlib.PurePosixPath(src).name if not src.startswith('http') else src
        return '<img loading="lazy" src="'+html.escape(url, quote=True)+'" alt="'+html.escape(el.get('alt', ''), quote=True)+'">'
    body = html.escape(el.text or '') + ''.join(render(child,module)+html.escape(child.tail or '') for child in el)
    if 'MathML' in el.tag or 'Math/MathML' in el.tag:
        ET.register_namespace('', 'http://www.w3.org/1998/Math/MathML')
        return ET.tostring(el,encoding='unicode') if tag=='math' else body
    if tag == 'link':
        url=el.get('url')
        return '<a target="_blank" rel="noopener" href="'+html.escape(url,quote=True)+'">'+body+'</a>' if url and url.startswith(('https://','http://')) else body
    tags={'para':'p','title':'h3','section':'section','figure':'figure','caption':'figcaption','emphasis':'em','list':'ol' if el.get('list-type')=='enumerated' else 'ul','item':'li','entry':'td','row':'tr','table':'table','thead':'thead','tbody':'tbody','term':'strong','sup':'sup','sub':'sub','note':'aside','example':'aside','exercise':'section','problem':'div','solution':'details','definition':'aside','meaning':'p','quote':'blockquote'}
    dest=tags.get(tag)
    return '<'+dest+'>'+body+'</'+dest+'>' if dest else body
def module_read(module):
    cache=OUT / 'source-cache' / (module+'.xml')
    cache.parent.mkdir(exist_ok=True)
    if not cache.exists(): cache.write_bytes(get(BASE+'modules/'+module+'/index.cnxml'))
    root=ET.fromstring(cache.read_bytes())
    title=root.find('n:title',NS)
    content=root.find('n:content',NS)
    return {'id':module,'title':text(title) if title is not None else module,'html':render(content,module)}

collection=ET.fromstring(get(BASE+'collections/principles-economics-3e.collection.xml'))
module_ids=[el.get('document') for el in collection.findall('.//c:module',NS)]
print('Importing OpenStax modules:',len(module_ids),flush=True)
with concurrent.futures.ThreadPoolExecutor(max_workers=12) as pool: modules=dict(zip(module_ids,pool.map(module_read,module_ids)))
chapters=[]
for group in collection.find('c:content',NS):
    if group.tag.endswith('module'):
        m=modules[group.get('document')];chapters.append({'title':m['title'],'html':m['html']})
    else:
        title=text(group.find('m:title',NS))
        members=[modules[el.get('document')] for el in group.findall('.//c:module',NS)]
        chapters.append({'title':title,'html':''.join('<h2>'+html.escape(m['title'])+'</h2>'+m['html'] for m in members)})
translations=['前言','欢迎走进经济学','稀缺世界中的选择','需求与供给','劳动力市场与金融市场','弹性','消费者选择','生产、成本与行业结构','完全竞争','垄断','垄断竞争与寡头','垄断与反垄断政策','环境保护与负外部性','正外部性与公共物品','劳动力市场与收入','贫困与经济不平等','信息、风险与保险','金融市场','公共经济','宏观经济视角','经济增长','失业','通货膨胀','国际贸易与资本流动','总需求与总供给模型','凯恩斯学派视角','新古典学派视角','货币与银行','货币政策与银行监管','汇率与国际资本流动','政府预算与财政政策','政府借款的影响','世界各国的宏观经济政策','国际贸易','全球化与贸易保护','附录：经济学中的数学','附录：无差异曲线','附录：现值','附录：支出与产出模型','附录：公开市场操作与资产负债表']
for i,c in enumerate(chapters): c['title']=translations[i]+' · '+c['title']
images=sorted(set(re.findall(r'<img[^>]+src="([^"]+)"',''.join(c['html'] for c in chapters))))
print('Bundling illustrations:',len(images),flush=True)
def image_read(url):
    filename=pathlib.PurePosixPath(url).name
    cache=OUT/'source-cache'/filename
    if not cache.exists():cache.write_bytes(get(url))
    mime=mimetypes.guess_type(filename)[0] or 'image/png'
    return url,'data:'+mime+';base64,'+base64.b64encode(cache.read_bytes()).decode('ascii')
with concurrent.futures.ThreadPoolExecutor(max_workers=16) as pool: embedded=dict(pool.map(image_read,images))
for i,c in enumerate(chapters):
    for url in set(re.findall(r'<img[^>]+src="([^"]+)"',c['html'])):c['html']=c['html'].replace(url,embedded[url])
    filename='economics-chapter-'+str(i)+'.json'
    (OUT/filename).write_text(json.dumps({'html':c.pop('html')},ensure_ascii=False),encoding='utf-8')
    c['file']=filename
economics={'title':'经济学原理 3e','subtitle':'Principles of Economics 3e · English edition','author':'OpenStax · Rice University','license':'CC BY-NC-SA 4.0 · 非商业性使用，相同方式共享。正文由 CNXML 转为 HTML，目录标题译为中文，正文未翻译。','source':'https://github.com/openstax/osbooks-principles-economics-bundle','chapters':chapters}
(OUT/'economics.json').write_text(json.dumps(economics,ensure_ascii=False),encoding='utf-8')

print('Importing The Wealth of Nations',flush=True)
source=get('https://raw.githubusercontent.com/GITenberg/An-Inquiry-into-the-Nature-and-Causes-of-the-Wealth-of-Nations_3300/master/3300-8.txt').decode('latin-1').replace('\r','')
start=source.find('*** START');start=source.find('\n',start)+1
end=source.find('*** END')
body=source[start:end if end>0 else None]
blocks=re.split(r'\n\s*\n',body)
chapters=[];title='前言与目录';parts=[]
for block in blocks:
    clean=re.sub(r'\s+',' ',block).strip()
    if not clean: continue
    heading=(clean.startswith(('BOOK I','BOOK II','BOOK III','BOOK IV','BOOK V','CHAPTER I','CHAPTER V','CHAPTER X','INTRODUCTION')) and len(clean)<260)
    if heading:
        if parts: chapters.append({'title':title,'html':''.join(parts)})
        parts=[];title=clean
    else: parts.append('<p>'+html.escape(clean)+'</p>')
if parts:chapters.append({'title':title,'html':''.join(parts)})
wealth={'title':'国富论','subtitle':'The Wealth of Nations · English edition','author':'Adam Smith · 1776','license':'公版原著；保留 Project Gutenberg 电子书许可证。本文仅调整章节及段落排版。','source':'https://github.com/GITenberg/An-Inquiry-into-the-Nature-and-Causes-of-the-Wealth-of-Nations_3300','chapters':chapters}
(OUT/'wealth.json').write_text(json.dumps(wealth,ensure_ascii=False),encoding='utf-8')
(OUT/'wealth-source.txt').write_text(source,encoding='utf-8')
(OUT/'OPENSTAX-LICENSE.txt').write_bytes(get(BASE+'LICENSE'))
print('Done:',len(economics['chapters']),'OpenStax chapters;',len(wealth['chapters']),'Smith sections',flush=True)
