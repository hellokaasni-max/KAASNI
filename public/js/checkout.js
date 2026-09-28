// public/js/checkout.js
//
// Kaasni online-only checkout.
// The browser sends product IDs + quantities + sizes.
// The server calculates the real payable amount.

async function renderSummary() {
  const cart = getCart();

  const summaryEl = document.querySelector('#order-summary');
  const btn = document.querySelector('#place-order-btn');

  if (!cart || cart.length === 0) {
    summaryEl.innerHTML = `
      <p>
        Your bag is empty.
        <a
          href="/collection.html"
          style="text-decoration:underline;"
        >
          Go shopping
        </a>.
      </p>
    `;

    btn.disabled = true;
    return;
  }

  const subtotal = cartSubtotal();
  const fee = await getShippingFee();

  const rows = cart.map((item) => `
    <div class="sum-item">
      <div class="sum-thumb">${item.image ? `<img src="${escapeHtml(item.image)}" alt="">` : ''}</div>
      <div class="sum-info">
        <div class="sum-name">${escapeHtml(item.name)}</div>
        <small>${item.size ? `Size ${escapeHtml(item.size)} · ` : ''}Qty ${item.quantity}</small>
      </div>
      <span>${formatMoney(Number(item.price) * Number(item.quantity))}</span>
    </div>`).join('');

  summaryEl.innerHTML = `
    <h3 style="margin-bottom:18px;">Order summary</h3>
    ${rows}
    <div class="summary-row" style="margin-top:14px;">
      <span>Subtotal</span><span>${formatMoney(subtotal)}</span>
    </div>
    <div class="summary-row">
      <span>Shipping</span><span>${shippingLabel(fee)}</span>
    </div>
    <div class="summary-row total">
      <span>${fee === null ? 'Subtotal' : 'Total'}</span>
      <span>${formatMoney(subtotal + (fee || 0))}</span>
    </div>
    ${fee === null ? '<p class="form-note" style="margin-top:14px;">Shipping, if applicable, is added to the final payment amount.</p>' : ''}
  `;
}


// ============================================================
// CREATE RAZORPAY ORDER
// ============================================================
//
// IMPORTANT:
// We send ITEMS, not the amount.
//
// The server reads the actual product prices from PostgreSQL
// and calculates the final payable amount.

async function createRazorpayOrder(cart) {
  const result = await apiRequest(
    '/orders/payment/create',
    {
      method: 'POST',

      body: {
        items: cart.map((item) => ({
          product_id: item.product_id,
          quantity: item.quantity,
          size: item.size || null,
        })),
      },
    }
  );

  if (!result || !result.id) {
    throw new Error(
      'Unable to create online payment.'
    );
  }

  return result;
}


// ============================================================
// SUBMIT PAID ORDER
// ============================================================

async function submitPaidOrder(
  form,
  cart,
  paymentResponse
) {
  const payload = {
    customer: {
      name: form.name.value.trim(),
      phone: form.phone.value.trim(),
      email: form.email.value.trim(),
      address: form.address.value.trim(),
      city: form.city.value.trim(),
      state: form.state.value.trim(),
      pincode: form.pincode.value.trim(),
    },

    items: cart.map((item) => ({
      product_id: item.product_id,
      quantity: item.quantity,
      size: item.size || null,
    })),

    // Online payment only.
    payment_method: 'razorpay',

    notes: form.notes.value.trim(),

    razorpay_payment_id:
      paymentResponse.razorpay_payment_id,

    razorpay_order_id:
      paymentResponse.razorpay_order_id,

    razorpay_signature:
      paymentResponse.razorpay_signature,
  };

  return apiRequest(
    '/orders',
    {
      method: 'POST',
      body: payload,
    }
  );
}


// ============================================================
// CHECKOUT SUBMIT
// ============================================================

document
  .querySelector('#checkout-form')
  .addEventListener(
    'submit',
    async (e) => {
      e.preventDefault();

      const cart = getCart();

      if (!cart || cart.length === 0) {
        return;
      }

      const form = e.target;

      const errorEl =
        document.querySelector(
          '#checkout-error'
        );

      const btn =
        document.querySelector(
          '#place-order-btn'
        );

      errorEl.style.display = 'none';
      errorEl.textContent = '';

      btn.disabled = true;
      btn.textContent =
        'Starting secure payment…';

      try {
        // ------------------------------------------------------
        // Make sure Razorpay Checkout is available.
        // ------------------------------------------------------

        if (typeof Razorpay !== 'function') {
          throw new Error(
            'Razorpay Checkout could not be loaded. Please refresh and try again.'
          );
        }

        // ------------------------------------------------------
        // Create Razorpay order.
        //
        // IMPORTANT:
        // Send cart items including sizes.
        // Server calculates the amount.
        // ------------------------------------------------------

        const razorpayOrder =
          await createRazorpayOrder(cart);

        // ------------------------------------------------------
        // Open Razorpay Checkout.
        // ------------------------------------------------------

        const options = {
          key: razorpayOrder.key_id,

          amount:
            razorpayOrder.amount,

          currency:
            razorpayOrder.currency || 'INR',

          name:
            'Kaasni',

          description:
            'Kaasni online payment',

          order_id:
            razorpayOrder.id,

          prefill: {
            name:
              form.name.value.trim(),

            email:
              form.email.value.trim(),

            contact:
              form.phone.value.trim(),
          },

          notes: {
            source:
              'kaasni_checkout',
          },

          theme: {
            color: '#111111',
          },

          handler:
            async function (response) {
              try {
                btn.disabled = true;

                btn.textContent =
                  'Verifying payment…';

                // ------------------------------------------------
                // Send Razorpay payment response to server.
                //
                // Server verifies the signature BEFORE
                // creating the order.
                // ------------------------------------------------

                const result =
                  await submitPaidOrder(
                    form,
                    cart,
                    response
                  );

                // ------------------------------------------------
                // Payment and order successful.
                // ------------------------------------------------

                clearCart();

                sessionStorage.setItem(
                  'kaasni_last_order',
                  JSON.stringify(result)
                );

                window.location.href =
                  '/order-success.html';

              } catch (err) {
                console.error(
                  'Order creation error:',
                  err
                );

                errorEl.textContent =
                  err.message ||
                  'Payment succeeded, but we could not create your order. Please contact Kaasni support with your payment ID.';

                errorEl.style.display =
                  'block';

                btn.disabled = false;

                btn.textContent =
                  'Pay securely';
              }
            },

          modal: {
            ondismiss:
              function () {
                btn.disabled = false;

                btn.textContent =
                  'Pay securely';
              },
          },
        };

        const rzp =
          new Razorpay(options);

        // --------------------------------------------------------
        // Payment failure.
        // --------------------------------------------------------

        rzp.on(
          'payment.failed',
          function (response) {
            console.error(
              'Razorpay payment failed:',
              response.error
            );

            errorEl.textContent =
              response.error?.description ||
              'Payment failed. Please try again.';

            errorEl.style.display =
              'block';

            btn.disabled = false;

            btn.textContent =
              'Pay securely';
          }
        );

        rzp.open();

      } catch (err) {
        console.error(
          'Checkout error:',
          err
        );

        errorEl.textContent =
          err.message ||
          'Unable to start payment.';

        errorEl.style.display =
          'block';

        btn.disabled = false;

        btn.textContent =
          'Pay securely';
      }
    }
  );


// ============================================================
// INITIAL RENDER
// ============================================================

renderSummary();


// ============================================================
// PINCODE -> CITY / STATE
// ============================================================
// Fills city and state once a 6-digit pincode is entered. Never overwrites
// something the customer has already typed, and fails quietly (they can
// always type the fields themselves).

(function wirePincode() {
  const pin = document.querySelector('#pincode');
  const city = document.querySelector('#city');
  const state = document.querySelector('#state');
  if (!pin || !city || !state) return;

  pin.setAttribute('maxlength', '6');
  pin.setAttribute('pattern', '[1-9][0-9]{5}');
  let lastLooked = '';
  let autoCity = '';
  let autoState = '';

  pin.addEventListener('input', async () => {
    pin.value = pin.value.replace(/\D/g, '').slice(0, 6);
    const code = pin.value;
    if (code.length !== 6 || code === lastLooked) return;
    lastLooked = code;
    try {
      const res = await fetch(`https://api.postalpincode.in/pincode/${code}`);
      const data = await res.json();
      const office = data && data[0] && data[0].Status === 'Success' && data[0].PostOffice && data[0].PostOffice[0];
      if (!office || pin.value !== code) return;
      // Only fill fields that are empty or still hold our earlier auto-fill.
      if (!city.value || city.value === autoCity) { autoCity = office.District || office.Block || ''; city.value = autoCity; }
      if (!state.value || state.value === autoState) { autoState = office.State || ''; state.value = autoState; }
    } catch (e) { /* offline or blocked: customer types it */ }
  });
})();
