export type ApiResponse<T> = {
  success: true;
  message: string;
  data: T;
};

export type ApiErrorResponse = {
  success: false;
  message: string;
  errors?: Array<{
    field?: string;
    message: string;
  }>;
};

export type HealthStatus = {
  status: "ok";
  timestamp: string;
};