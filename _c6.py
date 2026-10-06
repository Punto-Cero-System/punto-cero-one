import os, asyncio
from dotenv import load_dotenv
load_dotenv('backend/.env')
load_dotenv('.env')
os.chdir('backend'); sys.path = sys.path if False else __import__('sys').path
import sys; sys.path.insert(0,'.')
from motor.motor_asyncio import AsyncIOMotorClient
async def m():
    c = AsyncIOMotorClient(os.environ['MONGO_URL']); db = c[os.environ['DB_NAME']]
    cols = ['posts','post_comments','post_reactions','post_views','post_saves','follows','hashtags','categories','companies','groups','events','jobs','messages','conversations','chat_messages','notifications','user_sessions','user_workspaces','system_identities','users','documents','discovery']
    out=[]
    for c_ in cols:
        try: out.append((c_, await db[c_].count_documents({})))
        except Exception: pass
    for n,cnt in out: print('   %-22s %5d docs' % (n, cnt))
    c.close()
asyncio.run(m())
