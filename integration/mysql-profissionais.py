import os, shutil, subprocess, tempfile, time, urllib.parse
from pathlib import Path
assert Path('integration/profissionais.integracao.mjs').is_file()
with tempfile.TemporaryDirectory(prefix='krypton-perfis-test-') as tmp:
    r=Path(tmp); (r/'data').mkdir(); (r/'base').mkdir(); (r/'base13').mkdir()
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
        contagem = run(cli+['krypton_perfis_teste','-e',"SELECT COUNT(*) FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL"],capture_output=True,text=True).stdout.strip()
        tabelas = run(cli+['-e',"SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='krypton_perfis_teste' AND table_name <> '_prisma_migrations'"],capture_output=True,text=True).stdout.strip()
        assert contagem == '14' and tabelas == '19', f'Banco novo inesperado: migrations={contagem}, tabelas={tabelas}'
        print('Banco novo: 14 migrations e 19 tabelas.')
        run(cli+['-e','DROP DATABASE krypton_perfis_teste; CREATE DATABASE krypton_perfis_teste CHARACTER SET utf8mb4'])
        base=r/'base'
        shutil.copyfile('prisma/schema.prisma',base/'schema.prisma')
        shutil.copytree('prisma/migrations',base/'migrations',ignore=shutil.ignore_patterns('20261202_*','20261203_*','20261204_documentos_profissionais'))
        run(deploy+['--schema',str(base/'schema.prisma')])
        contagem11 = run(cli+['krypton_perfis_teste','-e',"SELECT COUNT(*) FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL"],capture_output=True,text=True).stdout.strip()
        assert contagem11 == '11', f'Base histórica deveria ter 11 migrations, recebeu {contagem11}'
        run(cli+['krypton_perfis_teste','-e',"INSERT INTO usuarios (nome,email,role) VALUES ('Registro legado','legado@example.invalid','personal');"])
        run(deploy)
        assert run(cli+['krypton_perfis_teste','-e',"SELECT COUNT(*) FROM usuarios WHERE role='personal' AND profissional_ativo=1"],capture_output=True,text=True).stdout.strip()=='1'
        print('Upgrade das 11 migrations: registro legado preservado.')
        run(cli+['-e','DROP DATABASE krypton_perfis_teste; CREATE DATABASE krypton_perfis_teste CHARACTER SET utf8mb4'])
        base13=r/'base13'
        shutil.copyfile('prisma/schema.prisma',base13/'schema.prisma')
        shutil.copytree('prisma/migrations',base13/'migrations',ignore=shutil.ignore_patterns('20261204_documentos_profissionais'))
        run(deploy+['--schema',str(base13/'schema.prisma')])
        contagem13 = run(cli+['krypton_perfis_teste','-e',"SELECT COUNT(*) FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL"],capture_output=True,text=True).stdout.strip()
        assert contagem13 == '13', f'Base anterior deveria ter 13 migrations, recebeu {contagem13}'
        run(cli+['krypton_perfis_teste','-e',"INSERT INTO usuarios (nome,email,role) VALUES ('Legado 13','legado13@example.invalid','aluno');"])
        run(deploy)
        contagem14 = run(cli+['krypton_perfis_teste','-e',"SELECT COUNT(*) FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL"],capture_output=True,text=True).stdout.strip()
        legado13 = run(cli+['krypton_perfis_teste','-e',"SELECT COUNT(*) FROM usuarios WHERE email='legado13@example.invalid'"],capture_output=True,text=True).stdout.strip()
        tabelas14 = run(cli+['-e',"SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='krypton_perfis_teste' AND table_name <> '_prisma_migrations'"],capture_output=True,text=True).stdout.strip()
        fks14 = run(cli+['-e',"SELECT COUNT(*) FROM information_schema.referential_constraints WHERE constraint_schema='krypton_perfis_teste'"],capture_output=True,text=True).stdout.strip()
        assert (contagem14, legado13, tabelas14, fks14) == ('14','1','19','24'), f'Upgrade 13→14 divergiu: migrations={contagem14}, legado={legado13}, tabelas={tabelas14}, FKs={fks14}'
        print('Upgrade 13→14: 14 migrations, 19 tabelas, 24 FKs e registro anterior preservado.')
        run(['node','--test','integration/profissionais.integracao.mjs'])
    finally:
        proc.terminate()
        try: proc.wait(timeout=15)
        except subprocess.TimeoutExpired: proc.kill(); proc.wait()
