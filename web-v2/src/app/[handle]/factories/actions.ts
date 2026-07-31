"use server";

import { redirect } from "next/navigation";

export async function addLinkToHaul(handle: string, formData: FormData) {
  void formData;
  redirect(`/${handle}/factories?error=link`);
}
