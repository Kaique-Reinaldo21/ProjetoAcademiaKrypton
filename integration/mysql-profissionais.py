import os, shutil, subprocess, tempfile, time, urllib.parse
from pathlib import Path
assert Path('integration/profissionais.integracao.mjs').is_file()
with tempfile.TemporaryDirectory(prefix='krypton-perfis-test-') as tmp:
    r=Path(tmp); (r/'data').mkdir(); (r/'base').mkdir()
    socket=r/'mysql.sock'
    env={k:v for k,v in os.environ.items() if not k.startswith('MYSQL')}
    env.update(MYSQL_TEST_LOGIN_FILE=str(r/'no-login.cnf'),NODE_ENV='test',PAYMENT_MODE='demo',
       JWT_SECRET='segredo-ficticio-isolado-testes-perfis',
       DATABASE_URL='mysql://root@localhost/krypton_perfis_teste?socket='+urllib.parse.quote(str(socket),safe=''))
    for k in ('DEMO_DEPLOYMENT','DEMO_PRISMA_POOL','RENDER','RENDER_EXTERNAL_HOSTNAME',
              'PRISMA_SCHEMA_ENGINE_BINARY','PRISMA_QUERY_ENGINE_BINARY','PRISMA_QUERY_ENGINE_LIBRARY'):
        env.pop(k,None)
    servidor = shutil.which('mysqld') or '/usr/sbin/mysqld'
    cliente = shutil.which('mysql') or '/usr/bin/mysql'
    mysqld=[servidor,'--no-defaults',f'--datadir={r}/data',f'--tmpdir={r}',f'--log-error={r}/mysqld.log','--skip-networking','--mysqlx=OFF','--local-infile=OFF','--secure-file-priv=NULL','--persisted-globals-load=OFF']
    cli=[cliente,'--no-defaults','--protocol=SOCKET',f'--socket={socket}','-uroot','-NB']
    subprocess.run(mysqld+['--initialize-insecure'],env=env,timeout=50,check=True)
    proc=subprocess.Popen(mysqld+[f'--socket={socket}',f'--pid-file={r}/mysql.pid'],env=env)
    def run(c,**kwargs): return subprocess.run(c,env=env,timeout=90,check=True,**kwargs)
    try:
        for _ in range(150):
            if proc.poll() is not None: raise RuntimeError('MySQL descartável encerrou')
            if socket.is_socket(): break
            time.sleep(.1)
        else: raise RuntimeError('Socket indisponível')
        assert run(cli+['-e','SELECT @@socket,@@skip_networking'],capture_output=True,text=True).stdout.strip()==str(socket)+'\t1'
        deploy=['node','node_modules/prisma/build/index.js','migrate','deploy']
        run(cli+['-e','CREATE DATABASE krypton_perfis_teste CHARACTER SET utf8mb4'])
        run(deploy)
        print('Banco novo: todas as migrations aplicadas.')
        run(cli+['-e','DROP DATABASE krypton_perfis_teste; CREATE DATABASE krypton_perfis_teste CHARACTER SET utf8mb4'])
        base=r/'base'
        shutil.copyfile('prisma/schema.prisma',base/'schema.prisma')
        shutil.copytree('prisma/migrations',base/'migrations',ignore=shutil.ignore_patterns('20261202_*','20261203_*'))
        run(deploy+['--schema',str(base/'schema.prisma')])
        run(cli+['krypton_perfis_teste','-e',"INSERT INTO usuarios (nome,email,role) VALUES ('Registro legado','legado@example.invalid','personal');"])
        run(deploy)
        assert run(cli+['krypton_perfis_teste','-e',"SELECT COUNT(*) FROM usuarios WHERE role='personal' AND profissional_ativo=1"],capture_output=True,text=True).stdout.strip()=='1'
        print('Upgrade das 11 migrations: registro legado preservado.')
        run(['node','--test','integration/profissionais.integracao.mjs'])
    finally:
        proc.terminate()
        try: proc.wait(timeout=15)
        except subprocess.TimeoutExpired: proc.kill(); proc.wait()
