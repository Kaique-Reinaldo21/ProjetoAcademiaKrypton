import { MercadoPagoConfig, PreApprovalPlan } from 'mercadopago';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const client = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN });
const planApi = new PreApprovalPlan(client);

export async function registrarPlanoAcademia(){
    const planos = [
        {
            reason: "Academia Kripton - Plano Básico",
            auto_recurring: {
                frequency: 1,
                frequency_type: "months",
                transaction_amount: 44.90,
                currency_id: "BRL"
            }
        },
        {
            reason: "Academia Kripton - Plano Pro",
            auto_recurring: {
                frequency: 1,
                frequency_type: "months",
                transaction_amount: 70.00,
                currency_id: "BRL"
            }
        },
        {
            reason: "Academia Kripton - Plano Elite",
            auto_recurring: {
                frequency: 1,
                frequency_type: "months",
                transaction_amount: 180.00,
                currency_id: "BRL"
            }
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