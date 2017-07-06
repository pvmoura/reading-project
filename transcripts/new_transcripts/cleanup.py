import os

for dirpath, dirname, filenames in os.walk('.'):
  for f in filenames:
    if f.split('.')[1] == 'txt':
      with open(f, 'r') as t:
        lines = t.readlines()
        a = lines[0]
        b = '},{'.join(a.split('}{'))
        b = "[" + b + "]"
        with open(f.split('.')[0] + ".json", 'w') as j:
          j.write(b)
