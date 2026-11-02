import sys
import sqlite3
import json

def dump_cookies(db_path):
    conn = sqlite3.connect(db_path)
    c = conn.cursor()
    c.execute('SELECT host_key, name, value, hex(encrypted_value) FROM cookies WHERE host_key LIKE "%google%"')
    rows = [{'name': r[1], 'val': r[2], 'hex': r[3]} for r in c.fetchall()]
    print(json.dumps(rows))

if __name__ == '__main__':
    if len(sys.argv) > 1:
        dump_cookies(sys.argv[1])
