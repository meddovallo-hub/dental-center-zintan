const API = "/api";

async function api(url, options = {}) {
  const response = await fetch(API + url, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    ...options
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || "حدث خطأ");
  }

  return data;
}

/* تحميل الخدمات */
async function loadServices() {
  const box = document.getElementById("serviceCards");
  const select = document.getElementById("service_id");

  if (!box && !select) return;

  try {
    const services = await api("/services");

    if (box) {
      box.innerHTML = services.map(service => `
        <div class="card">
          <h3>${escapeHtml(service.name)}</h3>
          <p class="muted">${escapeHtml(service.description || "")}</p>
        </div>
      `).join("");
    }

    if (select) {
      select.innerHTML =
        `<option value="">اختر الخدمة</option>` +
        services.map(service =>
          `<option value="${service.id}">
            ${escapeHtml(service.name)}
          </option>`
        ).join("");
    }

  } catch (error) {
    console.error(error);
  }
}

/* تحميل الأطباء */
async function loadDoctors() {
  const box = document.getElementById("doctorCards");
  const select = document.getElementById("doctor_id");

  if (!box && !select) return;

  try {
    const doctors = await api("/doctors");

    if (box) {
      box.innerHTML = doctors.map(doctor => `
        <div class="card">
          <h3>د. ${escapeHtml(doctor.name)}</h3>
          <p class="muted">
            ${escapeHtml(doctor.specialty || "طبيب أسنان")}
          </p>
        </div>
      `).join("");
    }

    if (select) {
      select.innerHTML =
        `<option value="">اختر الطبيب</option>` +
        doctors.map(doctor =>
          `<option value="${doctor.id}">
            د. ${escapeHtml(doctor.name)}
          </option>`
        ).join("");
    }

  } catch (error) {
    console.error(error);
  }
}

/* إرسال الحجز */
async function submitBooking(event) {
  event.preventDefault();

  const form = event.target;
  const message = document.getElementById("bookingMessage");

  const data = {
    patient_name: form.patient_name.value.trim(),
    phone: form.phone.value.trim(),
    service_id: form.service_id.value,
    doctor_id: form.doctor_id.value || null,
    appointment_date: form.appointment_date.value,
    appointment_time: form.appointment_time.value,
    notes: form.notes.value.trim()
  };

  try {
    const result = await api("/bookings", {
      method: "POST",
      body: JSON.stringify(data)
    });

    if (message) {
      message.classList.remove("hidden");

      message.innerHTML = `
        <div class="confirmation">
          <h3>تم تسجيل طلب الحجز بنجاح ✅</h3>
          <p>
            رقم الحجز:
            <strong>${escapeHtml(String(result.id || ""))}</strong>
          </p>
          <p>
            سيتم مراجعة الطلب من إدارة المركز.
          </p>
        </div>
      `;
    }

    form.reset();

  } catch (error) {
    if (message) {
      message.classList.remove("hidden");

      message.innerHTML = `
        <div class="confirmation" style="background:#fff1f1;border-color:#f1bcbc">
          ❌ ${escapeHtml(error.message)}
        </div>
      `;
    }
  }
}

/* حماية عرض النصوص */
function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/* تشغيل الصفحة */
document.addEventListener("DOMContentLoaded", () => {

  loadServices();
  loadDoctors();

  const bookingForm = document.getElementById("bookingForm");

  if (bookingForm) {
    bookingForm.addEventListener("submit", submitBooking);
  }

});
