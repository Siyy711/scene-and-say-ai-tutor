import sys
# Builds the test page: the mock head (a stand-in for Claude and the database) + the real app.
# usage: python3 build_mock.py scene-and-say.html preview-mock.html
head=open('mock-head.html').read()
app=open(sys.argv[1]).read().rstrip('\n')
open(sys.argv[2],'w').write(head+app+'\n</body></html>')
