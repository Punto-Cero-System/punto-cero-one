import io
p='routes/access_bridge_routes.py'
s=io.open(p,encoding='utf-8',newline='').read()
m=s.replace('        status=(jwt_user or {}).get("status"),\n','')
assert m!=s, 'no se removio'
io.open(p,'w',encoding='utf-8',newline='').write(m)
print('  status eliminado temporalmente del Bridge')
