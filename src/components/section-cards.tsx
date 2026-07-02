"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Wallet,
  TrendingUp,
  DollarSign,
  User,
  Bell,
  Check,
  X,
  Shield,
  UserCog,
  Filter,
  RefreshCw,
  Clock,
  AlertCircle,
  Calendar,
} from "lucide-react";

export function SectionCards() {
  const { data: session } = useSession();
  const userRole = (session?.user as any)?.role;
  const [investorCount, setInvestorCount] = useState(0);
  const [currentSaldo, setCurrentSaldo] = useState(0);
  const [totalInvestasiYear, setTotalInvestasiYear] = useState(0);
  const [totalProfitYear, setTotalProfitYear] = useState(0);
  const [recentTransactions, setRecentTransactions] = useState<any[]>([]);
  const [quickTransactions, setQuickTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [hasNewData, setHasNewData] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [debug, setDebug] = useState<any>({});
  const [mounted, setMounted] = useState(false);

  // Filter states - UBAH DEFAULT DI SINI
  const [showOnlyUser, setShowOnlyUser] = useState(false); // DEFAULT: Semua Role (false)

  // Status approval filter options
  type ApprovalFilterType =
    | "all"
    | "pending"
    | "pendingAdmin1"
    | "pendingAdmin2"
    | "pendingBoth";
  const [approvalFilter, setApprovalFilter] =
    useState<ApprovalFilterType>("pending"); // DEFAULT: Semua Pending

  // Refs untuk menyimpan data sebelumnya dan interval
  const prevTransactionsRef = useRef<any[]>([]);
  const pollingIntervalRef = useRef<NodeJS.Timeout>();
  const refreshTimeoutRef = useRef<NodeJS.Timeout>();

  // ========== MOUNTED EFFECT ==========
  useEffect(() => {
    setMounted(true);
  }, []);

  // ========== FUNGSI FETCH DATA ==========
  const fetchInvestorCount = async () => {
    try {
      const response = await fetch("/api/investors?action=totalCount");
      const data = await response.json();
      setInvestorCount(data.total);
    } catch (error) {
      console.error("Failed to fetch investor count:", error);
    }
  };

  const fetchCurrentSaldo = async () => {
    try {
      const response = await fetch("/api/history?action=currentSaldo");
      if (response.ok) {
        const data = await response.json();
        setCurrentSaldo(data.totalSaldo);
      }
    } catch (error) {
      console.error("Failed to fetch current saldo:", error);
    }
  };

  const fetchTotalInvestasiYear = async () => {
    try {
      const response = await fetch("/api/breakdowns");
      if (response.ok) {
        const data = await response.json();
        const totalInvestasi = data.reduce(
          (sum: number, breakdown: any) => sum + Number(breakdown.nilai),
          0,
        );
        setTotalInvestasiYear(totalInvestasi);
        const totalProfit = data.reduce(
          (sum: number, breakdown: any) => sum + Number(breakdown.nilai) * 0.08,
          0,
        );
        setTotalProfitYear(totalProfit);
      }
    } catch (error) {
      console.error("Failed to fetch total investasi:", error);
    }
  };

  const fetchRecentTransactions = async () => {
    try {
      const response = await fetch("/api/history?action=recent");
      if (response.ok) {
        const data = await response.json();
        // action=recent returns array directly
        const transactions = Array.isArray(data) ? data : (data.data ?? []);
        const now = new Date();
        const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

        const recent = transactions.filter((transaction: any) => {
          const transactionDate = new Date(
            transaction.tanggal || transaction.createdAt,
          );
          return transactionDate >= oneWeekAgo;
        });

        const sortedRecent = recent.sort((a: any, b: any) => {
          const dateA = new Date(a.tanggal || a.createdAt);
          const dateB = new Date(b.tanggal || b.createdAt);
          return dateB.getTime() - dateA.getTime();
        });

        setRecentTransactions(sortedRecent);
      }
    } catch (error) {
      console.error("Failed to fetch recent transactions:", error);
    }
  };

  // ========== FUNGSI FETCH QUICK TRANSACTIONS ==========
  const fetchQuickTransactions = useCallback(async () => {
    setLoading(true);
    try {
      console.log("Fetching all transactions...");
      const response = await fetch("/api/history/all?limit=1000");
      if (response.ok) {
        const result = await response.json();

        const allTransactions = result.transactions || [];

        console.log("Total all transactions from API:", allTransactions.length);

        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        const thisMonthTransactions = allTransactions.filter((t: any) => {
          const transactionDate = new Date(t.tanggal || t.createdAt);
          return transactionDate >= startOfMonth;
        });

        const todayTransactions = thisMonthTransactions.filter((t: any) => {
          const today = new Date();
          const txDate = new Date(t.tanggal || t.createdAt);
          return txDate.toDateString() === today.toDateString();
        });

        console.log("This month transactions:", thisMonthTransactions.length);
        console.log("Today transactions:", todayTransactions.length);

        setQuickTransactions(thisMonthTransactions);
        prevTransactionsRef.current = thisMonthTransactions;
        setLastUpdated(new Date());
        setHasNewData(false);

        setDebug({
          totalApi: allTransactions.length,
          thisMonth: thisMonthTransactions.length,
          today: todayTransactions.length,
        });
      }
    } catch (error) {
      console.error("Failed to fetch transactions:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  // ========== FUNGSI REFRESH MANUAL ==========
  const handleManualRefresh = async () => {
    setHasNewData(false);
    await fetchQuickTransactions();
  };

  // ========== FUNGSI APPROVE/REJECT ==========
  const handleApprove = async (id: string) => {
    try {
      const res = await fetch(`/api/history/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: "APPROVE" }),
      });
      if (res.ok) {
        await fetchQuickTransactions();
        alert("Transaction approved successfully");
      } else {
        alert("Failed to approve transaction");
      }
    } catch (error) {
      console.error("Error approving transaction:", error);
      alert("Error approving transaction");
    }
  };

  const handleReject = async (id: string) => {
    try {
      const res = await fetch(`/api/history/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: "REJECT" }),
      });
      if (res.ok) {
        await fetchQuickTransactions();
        alert("Transaction rejected successfully");
      } else {
        alert("Failed to reject transaction");
      }
    } catch (error) {
      console.error("Error rejecting transaction:", error);
      alert("Error rejecting transaction");
    }
  };

  // ========== INITIAL LOADS ==========
  useEffect(() => {
    fetchInvestorCount();
    fetchCurrentSaldo();
    fetchTotalInvestasiYear();
    fetchRecentTransactions();
  }, []);

  // ========== SETUP POLLING ==========
  useEffect(() => {
    fetchQuickTransactions();

    pollingIntervalRef.current = setInterval(() => {
      console.log("Polling...");
      fetchQuickTransactions();
    }, 5000);

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
    };
  }, [fetchQuickTransactions]);

  // ========== FILTER LOGIC ==========
  const getTransactionRole = (transaction: any): string => {
    if (transaction.investor?.role) {
      return transaction.investor.role;
    }

    if (!transaction.investor) {
      return "SYSTEM";
    }

    return "UNKNOWN";
  };

  const isApproved = (transaction: any): boolean => {
    return (
      transaction.admin1_status === "APPROVE" &&
      transaction.admin2_status === "APPROVE"
    );
  };

  const isRejected = (transaction: any): boolean => {
    return (
      transaction.admin1_status === "REJECT" ||
      transaction.admin2_status === "REJECT"
    );
  };

  const isPendingAdmin1 = (transaction: any): boolean => {
    return (
      transaction.admin1_status !== "APPROVE" &&
      transaction.admin1_status !== "REJECT"
    );
  };

  const isPendingAdmin2 = (transaction: any): boolean => {
    return (
      transaction.admin2_status !== "APPROVE" &&
      transaction.admin2_status !== "REJECT"
    );
  };

  const isPendingBoth = (transaction: any): boolean => {
    return isPendingAdmin1(transaction) && isPendingAdmin2(transaction);
  };

  const filteredTransactions = quickTransactions.filter((transaction) => {
    const role = getTransactionRole(transaction);

    // Filter role: DEFAULT sekarang false (Semua Role)
    if (showOnlyUser && role !== "USER") {
      return false;
    }

    // Filter berdasarkan status approval
    switch (approvalFilter) {
      case "pending":
        return !isApproved(transaction) && !isRejected(transaction);
      case "pendingAdmin1":
        return isPendingAdmin1(transaction) && !isRejected(transaction);
      case "pendingAdmin2":
        return isPendingAdmin2(transaction) && !isRejected(transaction);
      case "pendingBoth":
        return isPendingBoth(transaction) && !isRejected(transaction);
      case "all":
      default:
        return true;
    }
  });

  const stats = {
    total: quickTransactions.length,
    filtered: filteredTransactions.length,
    byRole: {
      user: quickTransactions.filter((t) => getTransactionRole(t) === "USER")
        .length,
      admin: quickTransactions.filter((t) => getTransactionRole(t) === "ADMIN")
        .length,
      system: quickTransactions.filter(
        (t) => getTransactionRole(t) === "SYSTEM",
      ).length,
      unknown: quickTransactions.filter(
        (t) => getTransactionRole(t) === "UNKNOWN",
      ).length,
    },
    byStatus: {
      approved: quickTransactions.filter((t) => isApproved(t)).length,
      rejected: quickTransactions.filter((t) => isRejected(t)).length,
      pending: quickTransactions.filter((t) => !isApproved(t) && !isRejected(t))
        .length,
      pendingAdmin1: quickTransactions.filter(
        (t) => isPendingAdmin1(t) && !isRejected(t),
      ).length,
      pendingAdmin2: quickTransactions.filter(
        (t) => isPendingAdmin2(t) && !isRejected(t),
      ).length,
      pendingBoth: quickTransactions.filter(
        (t) => isPendingBoth(t) && !isRejected(t),
      ).length,
    },
  };

  if (!mounted) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4 px-4 lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-4 bg-gray-200 rounded w-24"></div>
                <div className="h-8 bg-gray-300 rounded w-32 mt-2"></div>
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
        <Card className="@container/card">
          <CardHeader>
            <CardDescription>Total Investors</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums @[150px]/card:text-3xl flex items-center gap-2">
              {investorCount}
            </CardTitle>
            <CardAction>
              <User className="h-4 w-4 text-muted-foreground" />
            </CardAction>
          </CardHeader>
        </Card>

        <Card className="@container/card">
          <CardHeader>
            <CardDescription>Saldo Terkini</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
              {new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(Math.round(currentSaldo))}
            </CardTitle>
            <CardAction>
              <Wallet className="h-4 w-4 text-muted-foreground" />
            </CardAction>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1.5 text-sm">
            <div className="text-muted-foreground">
              Total saldo semua investor
            </div>
          </CardFooter>
        </Card>

        <Card className="@container/card">
          <CardHeader>
            <CardDescription>Total Investasi selama setahun</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
              {new Intl.NumberFormat("id-ID", {
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
              }).format(totalInvestasiYear)}
            </CardTitle>
            <CardAction>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardAction>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1.5 text-sm">
            <div className="text-muted-foreground">
              Total investasi dalam satu tahun
            </div>
          </CardFooter>
        </Card>

        <Card className="@container/card">
          <CardHeader>
            <CardDescription>Total Profit Selama setahun</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
              {new Intl.NumberFormat("id-ID", {
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
              }).format(totalProfitYear)}
            </CardTitle>
            <CardAction>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardAction>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1.5 text-sm">
            <div className="text-muted-foreground">
              Total profit dalam satu tahun
            </div>
          </CardFooter>
        </Card>
      </div>

      {/* Debug Panel */}
      <div className="px-4 lg:px-6">
        <Card className="bg-gray-100 dark:bg-gray-800">
          <CardContent className="py-2">
            <div className="text-xs font-mono">
              <div className="flex gap-4 flex-wrap">
                <span>🔍 API Total: {debug.totalApi || 0}</span>
                <span>📅 Bulan Ini: {debug.thisMonth || 0}</span>
                <span>📅 Hari Ini: {debug.today || 0}</span>
                <span>⏱️ Update: {lastUpdated.toLocaleTimeString()}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter and Refresh Controls */}
      {(userRole === "ADMIN" ||
        userRole === "SUPER_ADMIN" ||
        userRole === "ADMIN1" ||
        userRole === "ADMIN2") && (
        <div className="px-4 lg:px-6">
          <Card className="bg-gray-50 dark:bg-gray-900">
            <CardContent className="py-3">
              <div className="flex flex-wrap gap-3 items-center">
                {/* Left side - Role Filter */}
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium flex items-center gap-1">
                    <Filter className="h-4 w-4" /> Role:
                  </span>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowOnlyUser(!showOnlyUser)}
                    className={`h-8 ${showOnlyUser ? "bg-blue-100 border-blue-300" : "bg-gray-100"}`}
                  >
                    <User className="h-3 w-3 mr-1" />
                    {showOnlyUser ? "Hanya User" : "Semua Role"}
                  </Button>
                </div>

                {/* Approval Status Filter */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium flex items-center gap-1">
                    <Clock className="h-4 w-4" /> Status:
                  </span>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setApprovalFilter("pending")}
                    className={`h-8 ${approvalFilter === "pending" ? "bg-green-100 border-green-300" : ""}`}
                  >
                    <Clock className="h-3 w-3 mr-1" />
                    Semua Pending ({stats.byStatus.pending})
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setApprovalFilter("pendingBoth")}
                    className={`h-8 ${approvalFilter === "pendingBoth" ? "bg-yellow-100 border-yellow-300" : ""}`}
                  >
                    <AlertCircle className="h-3 w-3 mr-1" />
                    Pending Both ({stats.byStatus.pendingBoth})
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setApprovalFilter("pendingAdmin1")}
                    className={`h-8 ${approvalFilter === "pendingAdmin1" ? "bg-orange-100 border-orange-300" : ""}`}
                  >
                    <User className="h-3 w-3 mr-1" />
                    Pending Admin1 ({stats.byStatus.pendingAdmin1})
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setApprovalFilter("pendingAdmin2")}
                    className={`h-8 ${approvalFilter === "pendingAdmin2" ? "bg-purple-100 border-purple-300" : ""}`}
                  >
                    <User className="h-3 w-3 mr-1" />
                    Pending Admin2 ({stats.byStatus.pendingAdmin2})
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setApprovalFilter("all")}
                    className={`h-8 ${approvalFilter === "all" ? "bg-gray-100 border-gray-300" : ""}`}
                  >
                    Semua ({stats.total})
                  </Button>
                </div>

                {/* Right side - Refresh Controls */}
                <div className="flex items-center gap-2 ml-auto">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setAutoRefresh(!autoRefresh)}
                    className={`h-8 ${autoRefresh ? "bg-green-100 border-green-300" : ""}`}
                  >
                    <RefreshCw
                      className={`h-3 w-3 mr-1 ${autoRefresh ? "animate-spin" : ""}`}
                    />
                    {autoRefresh ? "Auto Refresh ON" : "Auto Refresh OFF"}
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleManualRefresh}
                    disabled={loading}
                    className={`h-8 ${hasNewData ? "bg-yellow-100 border-yellow-300 animate-pulse" : ""}`}
                  >
                    <RefreshCw
                      className={`h-3 w-3 mr-1 ${loading ? "animate-spin" : ""}`}
                    />
                    Refresh
                  </Button>
                </div>
              </div>

              {/* Stats Bar */}
              <div className="flex flex-wrap gap-4 mt-3 text-xs border-t pt-2">
                <span className="font-medium">📊 Statistik:</span>
                <span className="text-blue-600">Total: {stats.total}</span>
                <span className="text-green-600">
                  User: {stats.byRole.user}
                </span>
                <span className="text-purple-600">
                  Admin: {stats.byRole.admin}
                </span>
                <span className="text-gray-600">
                  System: {stats.byRole.system}
                </span>
                <span className="text-yellow-600">
                  Pending: {stats.byStatus.pending}
                </span>
                <span className="text-blue-600">
                  Approved: {stats.byStatus.approved}
                </span>
                <span className="text-red-600">
                  Rejected: {stats.byStatus.rejected}
                </span>
                <span className="text-gray-600 font-bold">
                  Ditampilkan: {filteredTransactions.length}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Transactions List */}
      {loading && !quickTransactions.length ? (
        <div className="px-4 lg:px-6">
          <Card className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950">
            <CardContent className="py-8">
              <div className="flex justify-center items-center">
                <RefreshCw className="h-6 w-6 animate-spin text-blue-500 mr-2" />
                <p className="text-muted-foreground">Loading transactions...</p>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="px-4 lg:px-6">
          <Card className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Bell className="h-4 w-4 text-blue-600" />
                  Transaksi Bulan Ini
                  <span className="text-xs bg-blue-200 text-blue-800 px-2 py-0.5 rounded-full">
                    {filteredTransactions.length} dari{" "}
                    {quickTransactions.length}
                  </span>
                </CardTitle>

                {/* Show today's count */}
                <Badge
                  variant="outline"
                  className="bg-green-100 text-green-800"
                >
                  <Calendar className="h-3 w-3 mr-1" />
                  Hari Ini:{" "}
                  {
                    quickTransactions.filter((t) => {
                      const today = new Date();
                      const txDate = new Date(t.tanggal || t.createdAt);
                      return txDate.toDateString() === today.toDateString();
                    }).length
                  }
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="pt-0">
              {filteredTransactions.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">
                    Tidak ada transaksi dengan filter ini
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    Total: {stats.total} | User: {stats.byRole.user} | Pending:{" "}
                    {stats.byStatus.pending}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setShowOnlyUser(false);
                      setApprovalFilter("pending");
                    }}
                    className="mt-2"
                  >
                    Reset Filter
                  </Button>
                </div>
              ) : (
                <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
                  {filteredTransactions.map((transaction, index) => {
                    const role = getTransactionRole(transaction);
                    const approved = isApproved(transaction);
                    const rejected = isRejected(transaction);
                    const pendingAdmin1 = isPendingAdmin1(transaction);
                    const pendingAdmin2 = isPendingAdmin2(transaction);

                    let borderColor = "border-l-gray-300";
                    let bgColor = "";

                    if (role === "USER") {
                      if (approved) {
                        borderColor = "border-l-blue-500";
                        bgColor = "bg-blue-50/50";
                      } else if (rejected) {
                        borderColor = "border-l-red-500";
                        bgColor = "bg-red-50/50";
                      } else if (pendingAdmin1 && pendingAdmin2) {
                        borderColor = "border-l-yellow-500";
                        bgColor = "bg-yellow-50/50";
                      } else if (!pendingAdmin1 && pendingAdmin2) {
                        borderColor = "border-l-purple-500";
                        bgColor = "bg-purple-50/50";
                      } else if (pendingAdmin1 && !pendingAdmin2) {
                        borderColor = "border-l-orange-500";
                        bgColor = "bg-orange-50/50";
                      } else {
                        borderColor = "border-l-green-500";
                        bgColor = "bg-green-50/50";
                      }
                    } else if (role === "ADMIN") {
                      borderColor = "border-l-purple-500";
                      bgColor = "bg-purple-50/50";
                    } else if (role === "SYSTEM") {
                      borderColor = "border-l-gray-500";
                      bgColor = "bg-gray-50/50";
                    }

                    const isToday = (() => {
                      const today = new Date();
                      const txDate = new Date(
                        transaction.tanggal || transaction.createdAt,
                      );
                      return txDate.toDateString() === today.toDateString();
                    })();
                    return (
                      <div
                        key={transaction.id || index}
                        className={`flex flex-col gap-1 text-sm p-3 rounded border-l-4 ${borderColor} ${bgColor} transition-all hover:shadow-md ${isToday ? "ring-1 ring-blue-300" : ""}`}
                      >
                        {isToday && (
                          <div className="text-xs font-semibold text-blue-600 mb-1 flex items-center gap-1">
                            <span className="w-2 h-2 bg-blue-600 rounded-full animate-pulse"></span>
                            Transaksi Hari Ini
                          </div>
                        )}

                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium">
                              {transaction.investor?.kode ||
                                transaction.kode ||
                                "No Kode"}{" "}
                              -{" "}
                              {transaction.investor?.nama ||
                                transaction.nama ||
                                "Unknown"}
                            </span>

                            <Badge
                              variant="outline"
                              className={`
                              text-xs
                              ${role === "USER" ? "bg-green-100 text-green-800" : ""}
                              ${role === "ADMIN" ? "bg-purple-100 text-purple-800" : ""}
                              ${role === "SYSTEM" ? "bg-gray-100 text-gray-800" : ""}
                            `}
                            >
                              {role}
                            </Badge>

                            <Badge
                              variant={
                                transaction.mutasi === "KREDIT"
                                  ? "default"
                                  : "destructive"
                              }
                              className={
                                transaction.mutasi === "KREDIT"
                                  ? "text-xs bg-green-100 text-green-800"
                                  : "text-xs bg-red-100 text-red-800"
                              }
                            >
                              {transaction.mutasi === "KREDIT"
                                ? "Kredit"
                                : "Debet"}
                            </Badge>

                            {!approved && !rejected && (
                              <>
                                {pendingAdmin1 && pendingAdmin2 && (
                                  <Badge
                                    variant="outline"
                                    className="text-xs bg-yellow-100 text-yellow-800"
                                  >
                                    Pending Both
                                  </Badge>
                                )}
                                {!pendingAdmin1 && pendingAdmin2 && (
                                  <Badge
                                    variant="outline"
                                    className="text-xs bg-purple-100 text-purple-800"
                                  >
                                    Pending Admin2
                                  </Badge>
                                )}
                                {pendingAdmin1 && !pendingAdmin2 && (
                                  <Badge
                                    variant="outline"
                                    className="text-xs bg-orange-100 text-orange-800"
                                  >
                                    Pending Admin1
                                  </Badge>
                                )}
                              </>
                            )}

                            {approved && (
                              <Badge
                                variant="outline"
                                className="text-xs bg-blue-100 text-blue-800"
                              >
                                APPROVED
                              </Badge>
                            )}

                            {rejected && (
                              <Badge
                                variant="outline"
                                className="text-xs bg-red-100 text-red-800"
                              >
                                REJECTED
                              </Badge>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            {session &&
                              (userRole === "ADMIN" ||
                                userRole === "SUPER_ADMIN" ||
                                userRole === "ADMIN1" ||
                                userRole === "ADMIN2") &&
                              role === "USER" &&
                              !approved &&
                              !rejected && (
                                <>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 px-2 text-xs bg-green-50 hover:bg-green-100 border-green-200"
                                    onClick={() =>
                                      handleApprove(transaction.id)
                                    }
                                  >
                                    <Check className="h-3 w-3 mr-1" />
                                    Approve
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 px-2 text-xs bg-red-50 hover:bg-red-100 border-red-200"
                                    onClick={() => handleReject(transaction.id)}
                                  >
                                    <X className="h-3 w-3 mr-1" />
                                    Reject
                                  </Button>
                                </>
                              )}
                            <span className="font-semibold text-blue-600">
                              Rp{" "}
                              {new Intl.NumberFormat("id-ID").format(
                                transaction.nilai_mutasi || 0,
                              )}
                            </span>
                          </div>
                        </div>

                        {transaction.keterangan && (
                          <div className="text-xs text-gray-600 pl-2 mt-1">
                            📝 {transaction.keterangan}
                          </div>
                        )}

                        {transaction.bukti_transfer && (
                          <div className="text-xs pl-2 mt-1">
                            <a
                              href={transaction.bukti_transfer}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-800 underline flex items-center gap-1"
                            >
                              📎 Lihat Bukti Transfer
                            </a>
                          </div>
                        )}

                        <div className="text-xs text-gray-500 pl-2 mt-1 flex gap-3">
                          <span
                            className={
                              pendingAdmin1
                                ? "text-yellow-600 font-semibold"
                                : "text-green-600"
                            }
                          >
                            Admin1: {transaction.admin1_status || "PENDING"}
                          </span>
                          <span
                            className={
                              pendingAdmin2
                                ? "text-yellow-600 font-semibold"
                                : "text-green-600"
                            }
                          >
                            Admin2: {transaction.admin2_status || "PENDING"}
                          </span>
                        </div>

                        <div className="text-xs text-gray-400 pl-2 mt-1 flex gap-3">
                          <span>
                            🕒{" "}
                            {new Date(
                              transaction.tanggal || transaction.createdAt,
                            ).toLocaleString()}
                          </span>
                          {transaction.id && (
                            <span>ID: {transaction.id.substring(0, 8)}...</span>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  <div className="text-xs text-center text-gray-500 pt-2 border-t">
                    Menampilkan {filteredTransactions.length} dari{" "}
                    {filteredTransactions.length} transaksi
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
