import sys
# Builds the own-key page: the real app in a plain web page, with NO stand-in for Claude.
# This is what GitHub Pages serves (S1): in the public repo, run-all.sh rebuilds index.html with it,
# so the page friends open always matches app/scene-and-say.html. On claude.ai the platform adds this wrapper itself.
# usage: python3 build_own.py ../app/scene-and-say.html preview-own.html
head=('<!doctype html><html lang="en"><head><meta charset="utf-8">'
      '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
      '<title>Scene &amp; Say</title>'
      '<meta name="description" content="Practise English through situations from your own life, with your own AI service.">'
      '<style>[hidden]{display:none!important}</style></head><body>\n')
app=open(sys.argv[1],encoding='utf-8').read().rstrip('\n')
open(sys.argv[2],'w',encoding='utf-8').write(head+app+'\n</body></html>\n')
