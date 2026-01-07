import SignInForm from "@/components/auth/SignInForm";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "ViTCam SignIn Page",
  description: "",
};

export default function SignIn() {
  return <SignInForm />;
}
