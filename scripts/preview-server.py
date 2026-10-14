"""Serve the complete local site while reading data continues to update."""
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlparse, unquote
import argparse

root = Path(__file__).resolve().parents[1]
site = root / 'dist/client'
reading = root / 'public/reading'

class Preview(SimpleHTTPRequestHandler):
    def __init__(self,*args,**kwargs):super().__init__(*args,directory=str(site),**kwargs)
    def translate_path(self,path):
        relative=unquote(urlparse(path).path).lstrip('/')
        if relative=='reading' or relative.startswith('reading/'):
            candidate=(reading/relative.removeprefix('reading').lstrip('/')).resolve()
            if candidate.is_relative_to(reading.resolve()) and 'source-cache' not in candidate.parts:return str(candidate)
            return str(reading/'not-found')
        return super().translate_path(path)

parser=argparse.ArgumentParser()
parser.add_argument('--port',type=int,default=8766)
options=parser.parse_args()
print(f'Complete local website: http://127.0.0.1:{options.port}/',flush=True)
ThreadingHTTPServer(('127.0.0.1',options.port),Preview).serve_forever()
