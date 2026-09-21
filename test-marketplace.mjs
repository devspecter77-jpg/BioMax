#!/usr/bin/env node
/**
 * Marketplace API test scripti
 * 
 * Ishlatish:
 * node test-marketplace.mjs
 */

import crypto from 'crypto'

const ERP_URL = 'https://qaqnus222.biznesjon.uz'
const HMAC_SECRET = '2ad59d54e510b60a3b6a5d03ee2f840e0a647a7f34fcc38bf993ce1d0ea7f65d'

/**
 * HMAC imzosini yaratish
 */
function createSignature(method, path, body = '') {
  const timestamp = Date.now().toString()
  const text = `${timestamp}\n${path}\n${body}`
  const signature = crypto
    .createHmac('sha256', HMAC_SECRET)
    .update(text)
    .digest('hex')
  
  return { timestamp, signature }
}

/**
 * API so'rov yuborish
 */
async function apiRequest(method, path, body = null) {
  const bodyText = body ? JSON.stringify(body) : ''
  const { timestamp, signature } = createSignature(method, path, bodyText)
  
  const url = `${ERP_URL}${path}`
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-MP-Timestamp': timestamp,
      'X-MP-Signature': signature,
      'X-MP-Version': '1.0.0',
    },
  }
  
  if (body) {
    options.body = bodyText
  }
  
  console.log(`\n🔵 ${method} ${path}`)
  console.log(`   Timestamp: ${timestamp}`)
  console.log(`   Signature: ${signature.substring(0, 16)}...`)
  
  try {
    const response = await fetch(url, options)
    const data = await response.json()
    
    if (response.ok) {
      console.log(`✅ Success (${response.status})`)
      console.log(JSON.stringify(data, null, 2))
    } else {
      console.log(`❌ Error (${response.status})`)
      console.log(JSON.stringify(data, null, 2))
    }
    
    return { ok: response.ok, status: response.status, data }
  } catch (error) {
    console.log(`💥 Request failed: ${error.message}`)
    return { ok: false, error }
  }
}

/**
 * Testlarni ishga tushirish
 */
async function runTests() {
  console.log('🚀 BioMax ERP ↔ Marketplace Integration Test')
  console.log('=' .repeat(60))
  
  // 1. Salomatlik tekshiruvi
  console.log('\n📋 Test 1: Salomatlik tekshiruvi')
  await apiRequest('GET', '/api/marketplace/salomatlik')
  
  // 2. Katalog
  console.log('\n📋 Test 2: Katalog')
  const katalog = await apiRequest('GET', '/api/marketplace/katalog')
  
  // Katalogdan birinchi tovarni olish
  let testTovarId = null
  if (katalog.ok && katalog.data.tovarlar && katalog.data.tovarlar.length > 0) {
    testTovarId = katalog.data.tovarlar[0].id
    console.log(`   Test uchun tovar: ${testTovarId}`)
  }
  
  // 3. Qoldiq tekshirish
  if (testTovarId) {
    console.log('\n📋 Test 3: Qoldiq tekshirish')
    await apiRequest('POST', '/api/marketplace/qoldiq', {
      tovarIds: [testTovarId]
    })
  }
  
  // 4. Do'kon ma'lumotlari
  console.log('\n📋 Test 4: Do\'kon ma\'lumotlari')
  await apiRequest('GET', '/api/marketplace/dokon')
  
  // 5. Mijoz topish/yaratish
  console.log('\n📋 Test 5: Mijoz topish/yaratish')
  await apiRequest('POST', '/api/marketplace/mijoz', {
    telefon: '+998901234567',
    ism: 'Test Foydalanuvchi',
    izoh: 'Test script orqali yaratilgan'
  })
  
  // 6. Rezerv (test raqami bilan)
  if (testTovarId) {
    console.log('\n📋 Test 6: Rezerv qo\'yish')
    const testBuyurtmaRaqam = `MP-2026-${Date.now().toString().slice(-5)}`
    const rezerv = await apiRequest('POST', '/api/marketplace/rezerv', {
      raqam: testBuyurtmaRaqam,
      qatorlar: [
        {
          erpTovarId: testTovarId,
          nomi: 'Test mahsulot',
          miqdor: 1
        }
      ]
    })
    
    // 7. Rezervni bo'shatish
    if (rezerv.ok) {
      console.log('\n📋 Test 7: Rezervni bo\'shatish')
      await apiRequest('POST', '/api/marketplace/rezerv-boshat', {
        buyurtmaRaqami: testBuyurtmaRaqam
      })
    }
  }
  
  console.log('\n' + '='.repeat(60))
  console.log('✨ Testlar tugadi!')
  console.log('\n📝 Eslatma: Bajarish (sotuv yaratish) testi qo\'shilmagan,')
  console.log('   chunki u haqiqiy sotuv yaratadi. Uni qo\'lda test qiling.')
}

// Testlarni ishga tushirish
runTests().catch(console.error)
