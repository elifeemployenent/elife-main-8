import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  ArrowUpRight,
  Building2,
  CalendarDays,
  Clock3,
  FileText,
  Landmark,
  Loader2,
  Megaphone,
  Phone,
  Send,
  UsersRound,
  WalletCards,
} from "lucide-react";
import { format } from "date-fns";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Textarea } from "@/components/ui/textarea";
import { useHomeViewPreference } from "@/hooks/useHomeViewPreference";
import { useSamrabhakaAuth } from "@/hooks/useSamrabhakaAuth";
import { useToast } from "@/hooks/use-toast";
import {
  readHomePanchayathPreference,
  resolveDirectPanchayath,
  saveHomePanchayathPreference,
  type PanchayathLinkOption,
} from "@/lib/homeViewPreference";
import { supabase } from "@/integrations/supabase/client";

type Panchayath = PanchayathLinkOption & { district: string | null };
type OfficeContact = {
  panchayath_id: string;
  panchayath_name: string;
  district: string | null;
  office_manager_name: string | null;
  office_manager_role: string | null;
  office_manager_ward: string | null;
  office_manager_mobile: string | null;
  office_secretary_name: string | null;
  office_secretary_role: string | null;
  office_secretary_ward: string | null;
  office_secretary_mobile: string | null;
};
type Program = {
  id: string;
  name: string;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
  panchayath_id: string | null;
  all_panchayaths: boolean;
};
type Announcement = {
  id: string;
  title: string;
  body: string;
  author_name: string;
  created_at: string;
};

function phoneDigits(value: string | null) {
  return value?.replace(/\D/g, "") ?? "";
}

function OfficeContactCard({
  title,
  name,
  role,
  ward,
  mobile,
}: {
  title: string;
  name: string | null;
  role: string | null;
  ward: string | null;
  mobile: string | null;
}) {
  const digits = phoneDigits(mobile);

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardDescription>{title}</CardDescription>
        <CardTitle className="text-xl">{name || "Not assigned yet"}</CardTitle>
        <p className="text-sm text-muted-foreground">
          {[role, ward ? `Ward ${ward}` : null].filter(Boolean).join(" · ") || "Panchayath Virtual Office"}
        </p>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        {digits ? (
          <>
            <Button asChild size="sm">
              <a href={`tel:${mobile}`} aria-label={`Call ${name || title}`}>
                <Phone className="mr-2 h-4 w-4" /> Call
              </a>
            </Button>
            <Button asChild size="sm" variant="outline">
              <a
                href={`https://wa.me/${digits}`}
                target="_blank"
                rel="noreferrer"
                aria-label={`WhatsApp ${name || title}`}
              >
                <Send className="mr-2 h-4 w-4" /> WhatsApp
              </a>
            </Button>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Contact number not published</p>
        )}
      </CardContent>
    </Card>
  );
}

export function VirtualOfficeHome() {
  const [searchParams, setSearchParams] = useSearchParams();
  const officeParam = searchParams.get("office");
  const { setView } = useHomeViewPreference();
  const { token, agent, isLoading: isAgentLoading } = useSamrabhakaAuth();
  const { toast } = useToast();

  const [panchayaths, setPanchayaths] = useState<Panchayath[]>([]);
  const [selectedPanchayathId, setSelectedPanchayathId] = useState("");
  const [office, setOffice] = useState<OfficeContact | null>(null);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [isLoadingLocations, setIsLoadingLocations] = useState(true);
  const [isLoadingOfficeData, setIsLoadingOfficeData] = useState(false);
  const [isLoadingAnnouncements, setIsLoadingAnnouncements] = useState(false);
  const [announcementError, setAnnouncementError] = useState("");
  const [announcementVersion, setAnnouncementVersion] = useState(0);
  const [canPublish, setCanPublish] = useState(false);
  const [isCheckingPublishAccess, setIsCheckingPublishAccess] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [announcementTitle, setAnnouncementTitle] = useState("");
  const [announcementBody, setAnnouncementBody] = useState("");
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishError, setPublishError] = useState("");

  const updateOfficeParam = useCallback(
    (value: string) => {
      setSearchParams((current) => {
        const next = new URLSearchParams(current);
        next.set("office", value);
        return next;
      }, { replace: true });
    },
    [setSearchParams],
  );

  useEffect(() => {
    let cancelled = false;
    const loadLocations = async () => {
      setIsLoadingLocations(true);
      const { data, error } = await supabase
        .from("panchayaths")
        .select("id, name, code, district")
        .eq("is_active", true)
        .order("name");

      if (cancelled) return;
      if (error) {
        setPanchayaths([]);
        toast({ title: "Panchayaths could not be loaded", description: error.message, variant: "destructive" });
      } else {
        setPanchayaths(data || []);
      }
      setIsLoadingLocations(false);
    };

    void loadLocations();
    return () => {
      cancelled = true;
    };
  }, [toast]);

  useEffect(() => {
    if (!panchayaths.length) return;
    const selected =
      resolveDirectPanchayath(officeParam, panchayaths) ??
      resolveDirectPanchayath(readHomePanchayathPreference(), panchayaths) ??
      panchayaths[0];
    setSelectedPanchayathId(selected.id);
    saveHomePanchayathPreference(selected.id);
    if (officeParam !== selected.id) updateOfficeParam(selected.id);
  }, [officeParam, panchayaths, updateOfficeParam]);

  const selectedPanchayath = panchayaths.find((item) => item.id === selectedPanchayathId) ?? null;

  const selectPanchayath = (id: string) => {
    if (!id) return;
    setSelectedPanchayathId(id);
    saveHomePanchayathPreference(id);
    updateOfficeParam(id);
  };

  useEffect(() => {
    if (!selectedPanchayathId) return;
    let cancelled = false;
    const loadOfficeData = async () => {
      setIsLoadingOfficeData(true);
      setAnnouncementError("");
      const [officeResult, programResult] = await Promise.all([
        supabase
          .from("panchayath_virtual_office_public")
          .select("panchayath_id, panchayath_name, district, office_manager_name, office_manager_role, office_manager_ward, office_manager_mobile, office_secretary_name, office_secretary_role, office_secretary_ward, office_secretary_mobile")
          .eq("panchayath_id", selectedPanchayathId)
          .maybeSingle(),
        supabase
          .from("programs")
          .select("id, name, description, start_date, end_date, panchayath_id, all_panchayaths")
          .eq("is_active", true)
          .or(`panchayath_id.eq.${selectedPanchayathId},all_panchayaths.eq.true`)
          .order("start_date", { ascending: true, nullsFirst: false }),
      ]);

      if (cancelled) return;
      if (officeResult.error) {
        setOffice(null);
      } else {
        setOffice(officeResult.data);
      }
      if (programResult.error) {
        setPrograms([]);
      } else {
        setPrograms((programResult.data || []) as Program[]);
      }
      setIsLoadingOfficeData(false);
    };

    void loadOfficeData();
    return () => {
      cancelled = true;
    };
  }, [selectedPanchayathId]);

  useEffect(() => {
    if (!selectedPanchayathId) return;
    let cancelled = false;
    const loadAnnouncements = async () => {
      setIsLoadingAnnouncements(true);
      setAnnouncementError("");
      const { data, error } = await supabase.rpc("get_public_virtual_office_announcements", {
        _panchayath_id: selectedPanchayathId,
      });
      if (cancelled) return;
      if (error) {
        setAnnouncements([]);
        setAnnouncementError("Announcements are temporarily unavailable.");
      } else {
        setAnnouncements((data || []) as Announcement[]);
      }
      setIsLoadingAnnouncements(false);
    };

    void loadAnnouncements();
    return () => {
      cancelled = true;
    };
  }, [announcementVersion, selectedPanchayathId]);

  useEffect(() => {
    if (!selectedPanchayathId || !token || !agent || isAgentLoading) {
      setCanPublish(false);
      setIsCheckingPublishAccess(false);
      return;
    }

    let cancelled = false;
    const checkPublishAccess = async () => {
      setCanPublish(false);
      setIsCheckingPublishAccess(true);
      const { data, error } = await supabase.functions.invoke("samrabhaka-auth", {
        body: {
          action: "can_post_virtual_office_announcement",
          panchayath_id: selectedPanchayathId,
        },
        headers: { "x-samrabhaka-token": token },
      });
      if (cancelled) return;
      setCanPublish(!error && data?.can_post === true);
      setIsCheckingPublishAccess(false);
    };

    void checkPublishAccess();
    return () => {
      cancelled = true;
    };
  }, [agent, isAgentLoading, selectedPanchayathId, token]);

  const publishAnnouncement = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPublishError("");
    const title = announcementTitle.trim();
    const body = announcementBody.trim();
    if (!title || title.length > 120) {
      setPublishError("Title must be between 1 and 120 characters.");
      return;
    }
    if (!body || body.length > 3000) {
      setPublishError("Announcement must be between 1 and 3,000 characters.");
      return;
    }
    if (!token || !selectedPanchayathId) {
      setPublishError("Sign in to your Samrambhaka account to continue.");
      return;
    }

    setIsPublishing(true);
    const { data, error } = await supabase.functions.invoke("samrabhaka-auth", {
      body: {
        action: "publish_virtual_office_announcement",
        panchayath_id: selectedPanchayathId,
        title,
        body,
      },
      headers: { "x-samrabhaka-token": token },
    });
    setIsPublishing(false);

    if (error || !data?.success) {
      setPublishError(data?.error || error?.message || "Announcement could not be published.");
      return;
    }

    setAnnouncementTitle("");
    setAnnouncementBody("");
    setIsDialogOpen(false);
    setAnnouncementVersion((version) => version + 1);
    toast({ title: "Announcement published" });
  };

  return (
    <main>
      <section className="border-b border-border bg-secondary/40">
        <div className="container grid gap-8 py-10 md:grid-cols-[minmax(0,1fr)_minmax(280px,360px)] md:items-end md:py-14">
          <div>
            <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-primary">
              <Landmark className="h-4 w-4" /> Panchayath Virtual Office
            </p>
            <h1 className="max-w-3xl text-3xl font-bold leading-tight text-foreground sm:text-4xl">
              Your local office, in one place.
            </h1>
            <p className="mt-3 max-w-2xl text-base text-muted-foreground">
              Find your office contacts, current programs, and public updates for your Panchayath.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="office-select">Choose a Panchayath</Label>
            <SearchableSelect
              options={panchayaths.map((item) => ({
                value: item.id,
                label: `${item.name}${item.district ? ` · ${item.district}` : ""}`,
              }))}
              value={selectedPanchayathId}
              onValueChange={selectPanchayath}
              disabled={isLoadingLocations || panchayaths.length === 0}
              placeholder={isLoadingLocations ? "Loading Panchayaths…" : "Search Panchayaths"}
              searchPlaceholder="Type a Panchayath name…"
              emptyText="No Panchayaths found."
              triggerClassName="h-12 bg-background"
            />
          </div>
        </div>
      </section>

      <div className="container space-y-12 py-8 md:py-10">
        {!isLoadingLocations && panchayaths.length === 0 && (
          <Alert>
            <AlertDescription>No active Panchayaths are available right now.</AlertDescription>
          </Alert>
        )}

        {selectedPanchayath && (
          <>
            <section aria-labelledby="office-contacts-title">
              <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-primary">{selectedPanchayath.district || "Local service"}</p>
                  <h2 id="office-contacts-title" className="text-2xl font-semibold text-foreground">
                    {selectedPanchayath.name} office contacts
                  </h2>
                </div>
                {isLoadingOfficeData && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <OfficeContactCard
                  title="Assigned Office Manager"
                  name={office?.office_manager_name ?? null}
                  role={office?.office_manager_role ?? null}
                  ward={office?.office_manager_ward ?? null}
                  mobile={office?.office_manager_mobile ?? null}
                />
                <OfficeContactCard
                  title="Assigned Office Secretary"
                  name={office?.office_secretary_name ?? null}
                  role={office?.office_secretary_role ?? null}
                  ward={office?.office_secretary_ward ?? null}
                  mobile={office?.office_secretary_mobile ?? null}
                />
              </div>
              {!office && !isLoadingOfficeData && (
                <p className="mt-3 text-sm text-muted-foreground">
                  Office assignments for this Panchayath have not been published yet.
                </p>
              )}
            </section>

            <section aria-labelledby="citizen-services-title" className="border-y border-border py-8">
              <div className="mb-5">
                <p className="text-sm font-medium text-primary">Local support</p>
                <h2 id="citizen-services-title" className="text-2xl font-semibold text-foreground">
                  Citizen services &amp; programs
                </h2>
              </div>
              <div className="mb-7 grid gap-3 sm:grid-cols-3">
                <Button asChild variant="outline" className="h-auto justify-between py-4">
                  <Link to="/programs">
                    <span className="flex items-center gap-3"><WalletCards className="h-5 w-5 text-primary" /> Browse all programs</span>
                    <ArrowUpRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline" className="h-auto justify-between py-4">
                  <Link to="/panchayaths">
                    <span className="flex items-center gap-3"><Building2 className="h-5 w-5 text-primary" /> Panchayath directory</span>
                    <ArrowUpRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline" className="h-auto justify-between py-4">
                  <Link to="/contact">
                    <span className="flex items-center gap-3"><UsersRound className="h-5 w-5 text-primary" /> Contact e-Life Society</span>
                    <ArrowUpRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>

              <div className="mb-4 flex items-center justify-between gap-3">
                <h3 className="text-lg font-semibold">Programs open in {selectedPanchayath.name}</h3>
                {isLoadingOfficeData && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
              </div>
              {programs.length ? (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {programs.map((program) => (
                    <Card key={program.id} className="flex h-full flex-col">
                      <CardHeader>
                        <CardTitle className="text-lg">{program.name}</CardTitle>
                        <CardDescription className="line-clamp-3">
                          {program.description || "Registration and program details are available online."}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="mt-auto space-y-4">
                        {(program.start_date || program.end_date) && (
                          <p className="flex items-center gap-2 text-sm text-muted-foreground">
                            <CalendarDays className="h-4 w-4 shrink-0" />
                            {program.start_date ? format(new Date(program.start_date), "d MMM yyyy") : "Open"}
                            {program.end_date ? ` – ${format(new Date(program.end_date), "d MMM yyyy")}` : ""}
                          </p>
                        )}
                        <Button asChild className="w-full">
                          <Link to={`/program/${program.id}`}>
                            View &amp; register <ArrowUpRight className="ml-2 h-4 w-4" />
                          </Link>
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : !isLoadingOfficeData ? (
                <p className="text-sm text-muted-foreground">There are no active programs for this Panchayath at the moment.</p>
              ) : null}
            </section>

            <section aria-labelledby="announcements-title">
              <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-primary">Public notice board</p>
                  <h2 id="announcements-title" className="text-2xl font-semibold text-foreground">
                    Announcements
                  </h2>
                </div>
                {canPublish && (
                  <Button onClick={() => setIsDialogOpen(true)}>
                    <Megaphone className="mr-2 h-4 w-4" /> Post announcement
                  </Button>
                )}
                {!canPublish && isCheckingPublishAccess && token && agent && (
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-label="Checking announcement access" />
                )}
              </div>

              {isLoadingAnnouncements ? (
                <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading announcements…
                </div>
              ) : announcementError ? (
                <Alert variant="destructive"><AlertDescription>{announcementError}</AlertDescription></Alert>
              ) : announcements.length ? (
                <div className="space-y-3">
                  {announcements.map((announcement) => (
                    <Card key={announcement.id}>
                      <CardContent className="grid gap-3 p-5 sm:grid-cols-[1fr_auto] sm:items-start">
                        <div className="space-y-2">
                          <h3 className="flex items-start gap-2 text-lg font-semibold">
                            <FileText className="mt-1 h-4 w-4 shrink-0 text-primary" />
                            {announcement.title}
                          </h3>
                          <p className="whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{announcement.body}</p>
                        </div>
                        <p className="flex items-center gap-2 text-xs text-muted-foreground sm:justify-end">
                          <Clock3 className="h-3.5 w-3.5 shrink-0" />
                          {format(new Date(announcement.created_at), "d MMM yyyy")}
                          {announcement.author_name ? ` · ${announcement.author_name}` : ""}
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No announcements have been posted for this Panchayath.</p>
              )}
            </section>
          </>
        )}

        <section className="flex flex-col gap-4 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold text-foreground">Prefer the existing home page?</p>
            <p className="text-sm text-muted-foreground">Switch back to Classic Home at any time.</p>
          </div>
          <Button variant="outline" onClick={() => setView("classic")}>
            <Landmark className="mr-2 h-4 w-4" /> Classic Home
          </Button>
        </section>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={(open) => {
        setIsDialogOpen(open);
        if (!open) setPublishError("");
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Post a Panchayath announcement</DialogTitle>
            <DialogDescription>
              Publish an update to the public notice board for {selectedPanchayath?.name || "this Panchayath"}.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={publishAnnouncement} className="space-y-4">
            {publishError && (
              <Alert variant="destructive"><AlertDescription>{publishError}</AlertDescription></Alert>
            )}
            <div className="space-y-2">
              <Label htmlFor="announcement-title">Title</Label>
              <Input
                id="announcement-title"
                value={announcementTitle}
                onChange={(event) => setAnnouncementTitle(event.target.value)}
                maxLength={120}
                required
              />
              <p className="text-right text-xs text-muted-foreground">{announcementTitle.length}/120</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="announcement-body">Announcement</Label>
              <Textarea
                id="announcement-body"
                value={announcementBody}
                onChange={(event) => setAnnouncementBody(event.target.value)}
                maxLength={3000}
                rows={6}
                required
              />
              <p className="text-right text-xs text-muted-foreground">{announcementBody.length}/3,000</p>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={isPublishing || !canPublish}>
                {isPublishing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Megaphone className="mr-2 h-4 w-4" />}
                Publish
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </main>
  );
}