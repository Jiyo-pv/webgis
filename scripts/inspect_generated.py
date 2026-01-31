import json
m = json.load(open('static/temperature_morning_dense.json'))
a = json.load(open('static/temperature_afternoon_dense.json'))
print('morning', len(m))
print('afternoon', len(a))
print('morning sample', m[:5])
print('afternoon sample', a[:5])
# Also print min/max intensities
print('morning intensity min/max', min(p[2] for p in m), max(p[2] for p in m))
print('afternoon intensity min/max', min(p[2] for p in a), max(p[2] for p in a))