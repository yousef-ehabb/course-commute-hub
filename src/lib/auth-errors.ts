export function getAuthErrorMessage(err: unknown): string {
  const message = (err as Error)?.message || "";
  
  if (
    message.includes("auth/invalid-credential") || 
    message.includes("auth/user-not-found") || 
    message.includes("auth/wrong-password")
  ) {
    return "البريد الإلكتروني أو كلمة المرور غير صحيحة، أو ربما تحتاج إلى إنشاء حساب أولاً.";
  }
  
  if (message.includes("auth/email-already-in-use")) {
    return "البريد الإلكتروني مستخدم لحساب آخر بالفعل.";
  }
  
  if (message.includes("auth/weak-password")) {
    return "كلمة المرور ضعيفة جداً. يجب أن تكون 6 أحرف على الأقل.";
  }
  
  if (message.includes("auth/invalid-email")) {
    return "صيغة البريد الإلكتروني غير صالحة.";
  }
  
  if (message.includes("auth/network-request-failed")) {
    return "فشل الاتصال بالإنترنت. يرجى التأكد من اتصالك والمحاولة مرة أخرى.";
  }
  
  if (message.includes("auth/too-many-requests")) {
    return "تم حظر الحساب مؤقتًا بسبب محاولات كثيرة خاطئة. يرجى المحاولة مرة أخرى لاحقًا.";
  }
  
  // Default fallback if we can't map the error
  console.error("Unmapped auth error:", message);
  return "حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى.";
}
