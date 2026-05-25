"use client";

import React from "react";
import { motion } from "framer-motion";
import { ArrowRight, CheckCircle2, Sparkles } from "lucide-react";
import { Button } from "../ui/button";
import { Card, CardContent } from "../ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "../ui/accordion";
import { fade } from "../../lib/prototype/fade";

export function WelcomeScreen({
  onStartTour,
  tourCompleted,
  hypothesisCompleted,
  simulationCompleted,
  resultsViewed,
  resultsCompleted,
  onVisitShop,
  onStartAB,
}) {
  return (
    <div className="mx-auto max-w-6xl px-4 pb-24 pt-10">
      <motion.div {...fade} transition={{ duration: 0.25 }}>
        <section className="relative overflow-hidden rounded-[2.75rem] bg-gradient-to-b from-[#7BAACB]/[0.22] to-black/[0.02] px-8 py-20">
          <div className="grid gap-12 lg:grid-cols-12">
            <div className="lg:col-span-7">
              <div className="inline-flex items-center gap-2 rounded-full border bg-white px-4 py-2 text-xs text-muted-foreground shadow-sm">
                <Sparkles className="h-4 w-4" />
                Milestone 2 - Student wizard
              </div>

              <h1 className="mt-6 text-5xl font-semibold tracking-tight">
                Learn A/B testing by running your own experiment
              </h1>

              <p className="mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground">
                This tool is a safe training environment. You'll tour a simple e-commerce shop, choose a hypothesis,
                run a simulated experiment, and review results.
              </p>

              <div className="mt-10 max-w-2xl">
                <Accordion type="single" collapsible className="w-full">
                  <AccordionItem value="learn" className="rounded-3xl border bg-white px-5">
                    <AccordionTrigger className="py-5 text-left text-sm font-semibold">
                      What you will learn
                    </AccordionTrigger>
                    <AccordionContent className="pb-6 text-sm text-muted-foreground">
                      You will practice defining a problem, writing a hypothesis, choosing metrics, and interpreting outcomes.
                      (Placeholder text; we'll refine later.)
                    </AccordionContent>
                  </AccordionItem>

                  <div className="h-3" />

                  <AccordionItem value="types" className="rounded-3xl border bg-white px-5">
                    <AccordionTrigger className="py-5 text-left text-sm font-semibold">
                      Types of experiments
                    </AccordionTrigger>
                    <AccordionContent className="pb-6 text-sm text-muted-foreground">
                      Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore
                      magna aliqua.
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>

                <div className="mt-6">
                  <div className="flex flex-wrap items-center gap-3">
                    <Button className="rounded-2xl px-7 py-6 text-base" onClick={onStartTour}>
                      {tourCompleted ? "Start the shop tour again" : "Start the shop tour"}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>

                    {tourCompleted ? (
                      <Button variant="outline" className="rounded-2xl px-7 py-6 text-base" onClick={onVisitShop}>
                        Visit the actual shop
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    ) : null}
                  </div>

                  {tourCompleted ? (
                    <div className="mt-3">
                      <Button className="rounded-2xl px-7 py-6 text-base shadow-md" onClick={onStartAB}>
                        Pick a hypothesis to start A/B testing
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="lg:col-span-5">
              <Card className="rounded-3xl shadow-sm">
                <CardContent className="p-6">
                  <div className="text-sm font-semibold">How it works</div>
                  <div className="mt-4 space-y-3 text-sm text-muted-foreground">
                    <div className="rounded-3xl border bg-white p-4">
                      <div className="flex items-center gap-2 font-semibold text-foreground">
                        {tourCompleted ? <CheckCircle2 className="h-5 w-5 text-green-600" /> : null}
                        <span>1) Tour the shop</span>
                      </div>
                      <div className="mt-1 text-xs">You'll see key pages and where users might drop off.</div>
                    </div>

                    <div className="rounded-3xl border bg-white p-4">
                      <div className="flex items-center gap-2 font-semibold text-foreground">
                        {hypothesisCompleted ? <CheckCircle2 className="h-5 w-5 text-green-600" /> : null}
                        <span>2) Pick a hypothesis</span>
                      </div>
                      <div className="mt-1 text-xs">We'll summarize known problems and let you choose a test.</div>
                    </div>

                    <div className="rounded-3xl border bg-white p-4">
                      <div className="flex items-center gap-2 font-semibold text-foreground">
                        {simulationCompleted ? <CheckCircle2 className="h-5 w-5 text-green-600" /> : null}
                        <span>3) Run a simulation</span>
                      </div>
                      <div className="mt-1 text-xs">A 15-second progress bar simulates traffic & measurement.</div>
                    </div>

                    <div className="rounded-3xl border bg-white p-4">
                      <div className="flex items-center gap-2 font-semibold text-foreground">
                        {resultsViewed ? <CheckCircle2 className="h-5 w-5 text-green-600" /> : null}
                        <span>4) See results</span>
                      </div>
                      <div className="mt-1 text-xs">Review outcome metrics (placeholder in Milestone 2).</div>
                    </div>

                    <div className="rounded-3xl border bg-white p-4">
                      <div className="flex items-center gap-2 font-semibold text-foreground">
                        {resultsCompleted ? <CheckCircle2 className="h-5 w-5 text-green-600" /> : null}
                        <span>5) Make a conclusion</span>
                      </div>
                      <div className="mt-1 text-xs">Decide what to ship, iterate, or test next.</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>
      </motion.div>
    </div>
  );
}
