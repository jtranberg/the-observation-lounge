const API_BASE_URL =
  import.meta.env.VITE_OBSERVATION_API_URL ||
  "http://localhost:5055";

async function parseResponse(response) {
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      data.message ||
        `Notification request failed with status ${response.status}.`
    );
  }

  return data;
}

export async function createNotification(input) {
  const response = await fetch(
    `${API_BASE_URL}/api/notifications`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    }
  );

  return parseResponse(response);
}

export async function getNotifications({
  status,
  limit = 50,
} = {}) {
  const searchParams = new URLSearchParams();

  searchParams.set("limit", String(limit));

  if (status) {
    searchParams.set("status", status);
  }

  const response = await fetch(
    `${API_BASE_URL}/api/notifications?${searchParams.toString()}`
  );

  return parseResponse(response);
}

export async function getUnreadNotificationCount() {
  const response = await fetch(
    `${API_BASE_URL}/api/notifications/unread-count`
  );

  return parseResponse(response);
}

export async function markNotificationAsRead(id) {
  const response = await fetch(
    `${API_BASE_URL}/api/notifications/${id}/read`,
    {
      method: "PATCH",
    }
  );

  return parseResponse(response);
}

export async function markAllNotificationsAsRead() {
  const response = await fetch(
    `${API_BASE_URL}/api/notifications/read-all`,
    {
      method: "PATCH",
    }
  );

  return parseResponse(response);
}