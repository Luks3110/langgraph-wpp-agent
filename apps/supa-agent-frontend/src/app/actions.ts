"use server";

import { createClient } from "../../supabase/server";
import { encodedRedirect } from "@/utils/utils";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { WorkflowAPI } from "@/lib/workflow-api";
import { WorkflowCreatePayload } from "@/types/workflow";

export const signUpAction = async (formData: FormData) => {
  const email = formData.get("email")?.toString();
  const password = formData.get("password")?.toString();
  const fullName = formData.get("full_name")?.toString() || "";
  const supabase = await createClient();
  const origin = (await headers()).get("origin");

  if (!email || !password) {
    return encodedRedirect(
      "error",
      "/sign-up",
      "Email and password are required"
    );
  }

  const {
    data: { user },
    error
  } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${origin}/auth/callback`,
      data: {
        full_name: fullName,
        email: email,
        name: fullName
      }
    }
  });

  if (error) {
    return encodedRedirect("error", "/sign-up", error.message);
  }

  // The database trigger should automatically create the user in public.users
  // Let's rely on the trigger and the auth callback to handle user creation
  if (user) {
    console.log("User created in auth.users:", {
      userId: user.id,
      email,
      fullName
    });
  }

  return encodedRedirect(
    "success",
    "/sign-up",
    "Thanks for signing up! Please check your email for a verification link."
  );
};

// Add a new action to ensure user exists in public.users table
export const ensureUserInPublicTable = async () => {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { success: false, error: "No authenticated user" };
  }

  // Check if user exists in public.users
  const { data: publicUser, error: queryError } = await supabase
    .from("users")
    .select("id, email, user_id")
    .eq("user_id", user.id)
    .single();

  if (queryError && queryError.code !== "PGRST116") {
    // PGRST116 is "not found" error
    console.error("Error querying public users:", queryError);
    return { success: false, error: "Database error" };
  }

  if (!publicUser) {
    // User doesn't exist in public.users, create them
    console.log("Creating missing user in public.users:", user.id);

    const { error: insertError } = await supabase.from("users").insert({
      id: user.id,
      user_id: user.id,
      name: user.user_metadata?.full_name || user.user_metadata?.name || "",
      full_name:
        user.user_metadata?.full_name || user.user_metadata?.name || "",
      email: user.email || "",
      token_identifier: user.id,
      created_at: new Date().toISOString()
    });

    if (insertError) {
      console.error("Failed to create user in public.users:", insertError);
      return { success: false, error: "Failed to create user record" };
    }

    console.log("Successfully created user in public.users");
    return { success: true, created: true };
  }

  return { success: true, created: false };
};

export const signInAction = async (formData: FormData) => {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    return encodedRedirect("error", "/sign-in", error.message);
  }

  return redirect("/dashboard");
};

export const forgotPasswordAction = async (formData: FormData) => {
  const email = formData.get("email")?.toString();
  const supabase = await createClient();
  const origin = (await headers()).get("origin");
  const callbackUrl = formData.get("callbackUrl")?.toString();

  if (!email) {
    return encodedRedirect("error", "/forgot-password", "Email is required");
  }

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?redirect_to=/protected/reset-password`
  });

  if (error) {
    return encodedRedirect(
      "error",
      "/forgot-password",
      "Could not reset password"
    );
  }

  if (callbackUrl) {
    return redirect(callbackUrl);
  }

  return encodedRedirect(
    "success",
    "/forgot-password",
    "Check your email for a link to reset your password."
  );
};

export const resetPasswordAction = async (formData: FormData) => {
  const supabase = await createClient();

  const password = formData.get("password") as string;
  const confirmPassword = formData.get("confirmPassword") as string;

  if (!password || !confirmPassword) {
    encodedRedirect(
      "error",
      "/protected/reset-password",
      "Password and confirm password are required"
    );
  }

  if (password !== confirmPassword) {
    encodedRedirect(
      "error",
      "/dashboard/reset-password",
      "Passwords do not match"
    );
  }

  const { error } = await supabase.auth.updateUser({
    password: password
  });

  if (error) {
    encodedRedirect(
      "error",
      "/dashboard/reset-password",
      "Password update failed"
    );
  }

  encodedRedirect("success", "/protected/reset-password", "Password updated");
};

export const signOutAction = async () => {
  const supabase = await createClient();
  await supabase.auth.signOut();
  return redirect("/sign-in");
};

export const checkUserSubscription = async (userId: string) => {
  const supabase = await createClient();

  const { data: subscription, error } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "active")
    .single();

  if (error) {
    return false;
  }

  return !!subscription;
};

export async function createWorkflowAction(
  workflowPayload: WorkflowCreatePayload
) {
  const supabase = await createClient();

  // Get the current user and session
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();
  if (userError || !user) {
    throw new Error("Authentication required");
  }

  const {
    data: { session },
    error: sessionError
  } = await supabase.auth.getSession();
  if (sessionError || !session) {
    throw new Error("No valid session");
  }

  try {
    console.log("Server action: Creating workflow with auth token");
    const savedWorkflow = await WorkflowAPI.createWorkflow(
      workflowPayload,
      session.access_token
    );

    // Revalidate the workflows page to show the new workflow
    revalidatePath("/workflows");

    return { success: true, workflow: savedWorkflow };
  } catch (error) {
    console.error("Server action: Error creating workflow:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred"
    };
  }
}

export async function updateWorkflowAction(
  workflowId: string,
  updates: {
    name?: string;
    description?: string;
    definition?: any;
  }
) {
  const supabase = await createClient();

  // Get the current user and session
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();
  if (userError || !user) {
    throw new Error("Authentication required");
  }

  const {
    data: { session },
    error: sessionError
  } = await supabase.auth.getSession();
  if (sessionError || !session) {
    throw new Error("No valid session");
  }

  try {
    console.log("Server action: Updating workflow with auth token");
    const updatedWorkflow = await WorkflowAPI.updateWorkflow(
      workflowId,
      updates,
      session.access_token
    );

    // Revalidate the workflows page
    revalidatePath("/workflows");
    revalidatePath(`/agents/create-flow?workflowId=${workflowId}`);

    return { success: true, workflow: updatedWorkflow };
  } catch (error) {
    console.error("Server action: Error updating workflow:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred"
    };
  }
}

export async function deleteWorkflowAction(workflowId: string) {
  const supabase = await createClient();

  // Get the current user and session
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();
  if (userError || !user) {
    throw new Error("Authentication required");
  }

  const {
    data: { session },
    error: sessionError
  } = await supabase.auth.getSession();
  if (sessionError || !session) {
    throw new Error("No valid session");
  }

  try {
    console.log("Server action: Deleting workflow with auth token");
    await WorkflowAPI.deleteWorkflow(workflowId, session.access_token);

    // Revalidate the workflows page
    revalidatePath("/workflows");

    return { success: true };
  } catch (error) {
    console.error("Server action: Error deleting workflow:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred"
    };
  }
}
