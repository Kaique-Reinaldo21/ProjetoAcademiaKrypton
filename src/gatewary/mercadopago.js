// como testar no terminal: Invoke-RestMethod -Uri "http://localhost:3000/api/checkout" -Method Post -ContentType "application/json" -Body '{"tipoPlano": "PRO"}'
// deve aparecer algo como: "url": "https://www.mercadopago.com.br/subscriptions/checkout?preapproval_plan_id=548bd7360d894f22a87a7443eb04f370..."

import 'dotenv/config'; 
import { MercadoPagoConfig, PreApproval } from 'mercadopago';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const client = new MercadoPagoConfig({ 
    accessToken: process.env.mercado_pago_access_token 
});

// Instância de PreApproval (usada para assinar um aluno a um plano existente)
const preApproval = new PreApproval(client);

// Mapeamento dos planos para os IDs do Mercado Pago
   const planMapping = {
    BASICO: {
        id: process.env.MP_PLAN_BASICO,
        reason: "Academia Kripton - Plano Básico",
        amount: 89.00
    },
    PRO: {
        id: process.env.MP_PLAN_PRO,
        reason: "Academia Kripton - Plano Pro",
        amount: 149.00
    },
    ELITE: {
        id: process.env.MP_PLAN_ELITE,
        reason: "Academia Kripton - Plano Elite",
        amount: 249.00
    }
};

/**
 * PB-16.2: Gera o link de checkout para o aluno
 */
export async function criarCheckoutAssinatura(tipoPlano, emailUsuario, usuarioId) {
    const planoSelecionado = planMapping[tipoPlano.toUpperCase()]; 

    if (!planoSelecionado) {
        throw new Error('Tipo de plano inválido. Escolha entre BASICO, PRO ou ELITE.');
    }

    // Cria a assinatura vinculada ao plano e ao usuário
    const response = await preApproval.create({
        body: {
           reason: planoSelecionado.reason,
            payer_email: emailUsuario,
            auto_recurring: {
                frequency: 1,
                frequency_type: "months",
                transaction_amount: planoSelecionado.amount,
                currency_id: "BRL"
            },
            // Guardamos usuarioId, tipoPlano e o planId como referencia externa
            external_reference: JSON.stringify({ 
                usuarioId, 
                tipoPlano: tipoPlano.toLowerCase(),
                mpPlanId: planoSelecionado.id 
            }),
            back_url: "https://www.academiakripton.com.br/checkout/success",
            status: "pending"
        }
    });

    // Link oficial da tela de pagamento do Mercado Pago
    return response.init_point;
}

/**
 * PB-16.3: Confirma o pagamento e ativa o plano no banco de dados
 */
export async function ativarPlano(preapprovalId) {
    // 1. Consulta os dados da assinatura direto na API do Mercado Pago
    const assinatura = await preApproval.get({ id: preapprovalId });

    // 2. Verifica se o status da assinatura está aprovado
    if (assinatura.status === 'authorized') {
        const dadosRef = JSON.parse(assinatura.external_reference);

        // Calcula a data de vencimento do plano (+30 dias)
        const dataVencimento = new Date();
        dataVencimento.setDate(dataVencimento.getDate() + 30);

        // 3. Salva na tabela 'planos' respeitando exatamente os campos do schema.prisma
        const planoAtivo = await prisma.planos.create({
            data: {
                usuario_id: Number(dadosRef.usuarioId),
                tipo: dadosRef.tipoPlano, // 'basico', 'pro' ou 'elite'
                ativo: true,
                vencimento: dataVencimento,
                mp_plan_id: dadosRef.mpPlanId
            }
        });

        return planoAtivo;
    }

    throw new Error(`Assinatura ainda não foi aprovada. Status atual: ${assinatura.status}`);
}