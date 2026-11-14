#!/usr/bin/env python3
"""Call only the fixed deployed notification dispatcher; never print its secret."""
import json
import os
import urllib.error
import urllib.request

URL = 'https://mon-enfant.vercel.app/api/internal/notifications'
FIELDS = {'status','claimed','accepted','retry','failed','needs_review','unacknowledged'}


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, request, fp, code, message, headers, new_url):
        return None


def validate(status, headers, body):
    if status != 200 or len(body)>4096 or 'no-store' not in headers.get('Cache-Control','').lower():
        raise ValueError('Dispatcher not verified.')
    data=json.loads(body)
    if not isinstance(data,dict) or set(data)!=FIELDS or data['status']!='completed':
        raise ValueError('Unexpected dispatcher response.')
    if any(type(data[key]) is not int or not 0<=data[key]<=3 for key in FIELDS-{'status'}):
        raise ValueError('Unexpected dispatcher counts.')
    if sum(data[key] for key in ('accepted','retry','failed','needs_review','unacknowledged'))!=data['claimed']:
        raise ValueError('Incomplete dispatcher accounting.')
    if any(data[key] for key in ('failed','needs_review','unacknowledged')):
        raise ValueError('Dispatcher requires review.')
    return data


def main():
    key=os.environ.get('APP_EMAIL_CRON_SECRET','')
    if len(key)<32:
        print(json.dumps({'status':'unconfigured'}));return 2
    try:
        request=urllib.request.Request(URL,data=b'',headers={'Authorization':'Bearer '+key,'Accept':'application/json'},method='POST')
        with urllib.request.build_opener(NoRedirect()).open(request,timeout=65) as response:
            result=validate(response.status,response.headers,response.read(4097))
    except Exception:
        print(json.dumps({'status':'unavailable'}));return 1
    print(json.dumps(result));return 0


if __name__=='__main__':
    raise SystemExit(main())
