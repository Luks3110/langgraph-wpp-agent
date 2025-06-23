import { createClient } from "../../../../../supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const redirect_to = requestUrl.searchParams.get("redirect_to");

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error("Error exchanging code for session:", error);
      return NextResponse.redirect(
        new URL("/sign-in?error=auth_error", requestUrl.origin)
      );
    }

    // Ensure user exists in public.users table
    if (data.user) {
      try {
        // Check if user exists in public.users
        const { data: publicUser, error: queryError } = await supabase
          .from("users")
          .select("id, email, user_id")
          .eq("user_id", data.user.id)
          .single();

        if (queryError && queryError.code === "PGRST116") {
          // User doesn't exist in public.users, create them
          console.log(
            "Creating user in public.users after auth callback:",
            data.user.id
          );

          const { error: insertError } = await supabase.from("users").insert({
            id: data.user.id,
            user_id: data.user.id,
            name:
              data.user.user_metadata?.full_name ||
              data.user.user_metadata?.name ||
              "",
            full_name:
              data.user.user_metadata?.full_name ||
              data.user.user_metadata?.name ||
              "",
            email: data.user.email || "",
            token_identifier: data.user.id,
            created_at: new Date().toISOString()
          });

          if (insertError) {
            console.error(
              "Failed to create user in public.users:",
              insertError
            );
            // Don't fail the login, but log the error
          } else {
            console.log("Successfully created user in public.users");
          }
        } else if (queryError) {
          console.error("Error querying public users:", queryError);
        } else {
          console.log(
            "User already exists in public.users:",
            publicUser?.email
          );
        }
      } catch (err) {
        console.error("Exception ensuring user in public table:", err);
      }
    }
  }

  // URL to redirect to after sign in process completes
  const redirectTo = redirect_to || "/dashboard";
  return NextResponse.redirect(new URL(redirectTo, requestUrl.origin));
}
