// Simple test script to verify logo loading
const { invoke } = require('@tauri-apps/api/core');

async function testLogo() {
    try {
        console.log('Testing logo loading...');
        const result = await invoke('test_logo_loading');
        console.log('Result:', result);
        
        // Also test generating a sample receipt
        console.log('Testing receipt generation...');
        const receipt = await invoke('build_order_receipt_html', { orderId: 1 });
        console.log('Receipt generated, length:', receipt.length);
        
        // Check if the receipt contains base64 data
        if (receipt.includes('data:image/png;base64,')) {
            console.log('✅ Logo found in receipt!');
        } else {
            console.log('❌ No logo found in receipt');
        }
        
    } catch (error) {
        console.error('Error:', error);
    }
}

testLogo();
