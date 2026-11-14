"""Small HTTPS-only HTML form client for synthetic operator smoke tests."""
import html.parser,http.cookiejar,urllib.request,uuid
SITE="https://mon-enfant.vercel.app"

class Forms(html.parser.HTMLParser):
 def __init__(self,source):
  super().__init__(convert_charrefs=True);self.forms=[];self.current=None;self.feed(source)
 def handle_starttag(self,tag,attrs):
  attrs=dict(attrs)
  if tag=='form':self.current={'fields':{},'names':set(),'text':''}
  elif self.current is not None and tag in ('input','select','textarea') and attrs.get('name'):
   self.current['names'].add(attrs['name'])
   if tag=='input' and attrs.get('type')=='hidden':self.current['fields'][attrs['name']]=attrs.get('value','')
 def handle_data(self,data):
  if self.current is not None:self.current['text']+=data
 def handle_endtag(self,tag):
  if tag=='form' and self.current is not None:self.forms.append(self.current);self.current=None
class Browser:
 def __init__(self):
  self.jar=http.cookiejar.CookieJar();self.opener=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(self.jar))
 def get(self,path):
  with self.opener.open(SITE+path,timeout=40) as r:return r.geturl(),r.read().decode('utf8'),r.headers
 def submit(self,path,page,fields,match,file=None):
  forms=Forms(page).forms;form=next(f for f in forms if match(f));values={**form['fields'],**fields}
  boundary='QA'+uuid.uuid4().hex;parts=[]
  for key,value in values.items():parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="{key}"\r\n\r\n{value}\r\n'.encode())
  if file:
   name,content=file;parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="{name}"; filename="synthetic.pdf"\r\nContent-Type: application/pdf\r\n\r\n'.encode()+content+b'\r\n')
  parts.append(f'--{boundary}--\r\n'.encode());req=urllib.request.Request(SITE+path,data=b''.join(parts),headers={'Content-Type':f'multipart/form-data; boundary={boundary}','Origin':SITE},method='POST')
  with self.opener.open(req,timeout=50) as r:return r.geturl(),r.read().decode('utf8'),r.headers
 def login(self,email,password):
  _,page,_=self.get('/login?audience=clinician');return self.submit('/login?audience=clinician',page,{'email':email,'password':password},lambda f:'email' in f['names'])
