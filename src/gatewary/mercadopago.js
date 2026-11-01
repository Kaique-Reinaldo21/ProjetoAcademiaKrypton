import 'dotenv/config'; // Carrega as variáveis do ficheiro .env
import { MercadoPagoConfig, PreApprovalPlan } from 'mercadopago';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const client = new MercadoPagoConfig({ accessToken: process.env.mercado_pago_access_token });
const planApi = new PreApprovalPlan(client);

export async function registrarPlanoAcademia(){
    const planos = [
        {
            reason: "Academia Kripton - Plano Básico",
            auto_recurring: {
                frequency: 1,
                frequency_type: "months",
                transaction_amount: 89.00,
                currency_id: "BRL"
            },
            back_url: "https://www.academiakripton.com.br/dashboard"
        },
        {
            reason: "Academia Kripton - Plano Pro",
            auto_recurring: {
                frequency: 1,
                frequency_type: "months",
                transaction_amount: 149.00,
                currency_id: "BRL"
            },
           back_url: "https://www.academiakripton.com.br/dashboard"
        },
        {
            reason: "Academia Kripton - Plano Elite",
            auto_recurring: {
                frequency: 1,
                frequency_type: "months",
                transaction_amount: 249.00,
                currency_id: "BRL"
            },
            back_url: "https://www.academiakripton.com.br/dashboard"
        }
    ];

    for (const p of planos){
         try {
            const response = await planApi.create({ body: p });
            console.log(`Plano registrado com sucesso! ID: ${response.id} - ${p.reason}`);
        } catch (error) {
            console.error(`Erro ao registrar o plano: ${p.reason}`, error);
        }
    }
}