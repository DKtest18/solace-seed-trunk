import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

export default function ManualPayment() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const productId = searchParams.get("productId");

  useEffect(() => {
    // Redirect to Stripe checkout - manual payments no longer supported
    if (productId) {
      navigate(`/checkout?productId=${productId}`);
    } else {
      navigate('/marketplace');
    }
  }, [productId, navigate]);

  return null;
}