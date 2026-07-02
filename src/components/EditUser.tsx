"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "./ui/form";
import { Input } from "./ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "./ui/button";

const formSchema = z.object({
  name: z.string().min(1, { message: "Name is required" }),
  email: z.string().optional(),
  kode: z.string().optional(),
  role: z.enum(["USER", "ADMIN", "ADMIN_1", "ADMIN_2", "SUPER_ADMIN"]),
  password: z.string().optional(),
});

import type { AppUser } from "@/types/user";

interface EditUserProps {
  user?: AppUser;
  onUpdate?: () => void;
}

const EditUser = ({ user, onUpdate }: EditUserProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: user?.name || "",
      email: user?.email || "",
      kode: user?.kode || "",
      role:
        (user?.role as
          | "USER"
          | "ADMIN"
          | "ADMIN_1"
          | "ADMIN_2"
          | "SUPER_ADMIN") || "USER",
    },
  });

  useEffect(() => {
    if (!user?.id) return;

    const fetchUserDetails = async () => {
      setFetchLoading(true);
      try {
        const response = await fetch(`/api/users/${user.id}`);
        if (response.ok) {
          const data = await response.json();
          form.reset({
            name: data.user.name || "",
            email: data.user.email || "",
            kode: data.user.kode || "",
            role:
              (data.user.role as
                | "USER"
                | "ADMIN"
                | "ADMIN_1"
                | "ADMIN_2"
                | "SUPER_ADMIN") || "USER",
          });
        } else {
          console.error("Failed to fetch user details");
        }
      } catch (error) {
        console.error("Error fetching user details:", error);
      } finally {
        setFetchLoading(false);
      }
    };

    fetchUserDetails();
  }, [user?.id, form]);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!user) return;
    setIsLoading(true);
    try {
      const response = await fetch(`/api/users/${user.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(values),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          `Failed to update user: ${response.status} ${response.statusText} - ${errorData.error || "Unknown error"}`,
        );
      }

      alert("User updated successfully");
      onUpdate?.();
    } catch (error) {
      alert(`Failed to update user: ${(error as Error).message}`);
      console.error("Error updating user:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormDescription>
                This is the user&apos;s display name.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormDescription>The user&apos;s email address.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="kode"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Kode</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormDescription>The user&apos;s kode.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="role"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Role</FormLabel>
              <FormControl>
                <Select onValueChange={field.onChange} value={field.value}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USER">User</SelectItem>
                    <SelectItem value="ADMIN">Admin</SelectItem>
                    <SelectItem value="ADMIN_1">Admin 1</SelectItem>
                    <SelectItem value="ADMIN_2">Admin 2</SelectItem>
                    <SelectItem value="SUPER_ADMIN">Super Admin</SelectItem>
                  </SelectContent>
                </Select>
              </FormControl>
              <FormDescription>
                The user&apos;s role in the system.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Password</FormLabel>
              <FormControl>
                <Input type="password" {...field} />
              </FormControl>
              <FormDescription>
                Leave blank to keep the current password.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={isLoading}>
          {isLoading ? "Updating..." : "Update User"}
        </Button>
      </form>
    </Form>
  );
};

export default EditUser;
