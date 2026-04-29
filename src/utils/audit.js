export const assertMutationPersisted = (response, contextLabel) => {
  const status = response?.status;
  if (!status || status < 200 || status >= 300) {
    throw new Error(`${contextLabel}: invalid HTTP status`);
  }

  const payload = response?.data;
  if (payload && typeof payload === 'object') {
    const explicitFailure = payload.success === false || payload.ok === false;
    if (explicitFailure) {
      throw new Error(`${contextLabel}: backend reported failure`);
    }
  }

  return response;
};

export const getApiErrorMessage = (error, fallbackMessage) => {
  const backendDetail =
    error?.response?.data?.detail ||
    error?.response?.data?.message ||
    error?.response?.data?.error;

  if (typeof backendDetail === 'string' && backendDetail.trim()) {
    return backendDetail;
  }

  return fallbackMessage;
};
