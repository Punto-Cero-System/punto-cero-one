import sys
sys.path.insert(0, 'backend')
import services.workspace_registry as wr
import services.entitlement_service as es
import services.policy_can as pc
import services.access_bridge as ab
print('registry_n=', len(wr.WORKSPACE_REGISTRY))
print('cores=', sorted({s['core_id'] for s in wr.WORKSPACE_REGISTRY}))
print('ents=', es.get_entitlements('u1', ['legal'], []))
print('can_allow=', pc.can('u1', 'workspace.open.legal', ['workspace.open.legal']))
print('can_deny=', pc.can('u1', 'workspace.open.medical', ['workspace.open.legal']))
print('intent=', ab.create_access_intent('u1', 'legal')['intent_code'][:8] + '...')
