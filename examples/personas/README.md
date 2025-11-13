# Blog Post Creation Workflow - Persona Examples

This directory contains example personas that work together to create world-class SEO and AI bot-friendly blog posts.

## Workflow Overview

The blog post creation workflow follows a sequential process where each persona has a specific responsibility:

1. **Requirements Collector** → Gathers requirements from users
2. **Content Writer** → Creates the initial draft
3. **SEO Reviewer** → Optimizes for search engines and AI bots
4. **Accuracy Reviewer** → Ensures factual accuracy and credibility
5. **Final Reviewer** → Performs final quality check and approval

## Personas

### 1. Requirements Collector (`requirements_collector`)

**Role**: Gather comprehensive requirements from users to create a detailed brief.

**Responsibilities**:
- Analyze user's initial input to identify core topic and intent
- Identify missing critical information
- Ask clarifying questions when needed
- Synthesize information into a structured brief
- Validate brief completeness

**Output**: Structured brief with topic, target keyword, audience, goals, key messages, tone, and word count target.

### 2. Content Writer (`content_writer`)

**Role**: Create high-quality, engaging blog post drafts based on provided briefs.

**Responsibilities**:
- Research the topic for accuracy and relevance
- Create logical structure (introduction, main sections, conclusion)
- Write engaging content optimized for both humans and AI bots
- Ensure natural keyword placement
- Maintain readability and engagement throughout

**Output**: Complete draft with title, meta description, content sections, and outline.

### 3. SEO Reviewer (`seo_reviewer`)

**Role**: Review drafts for SEO optimization and AI bot friendliness.

**Responsibilities**:
- Review keyword optimization and placement
- Analyze heading structure (H1, H2, H3) hierarchy
- Check for internal/external linking opportunities
- Review meta description and title tag optimization
- Assess AI bot readability and semantic structure
- Evaluate readability scores

**Output**: SEO scorecard with prioritized recommendations and updated draft if needed.

### 4. Accuracy Reviewer (`accuracy_reviewer`)

**Role**: Review drafts for factual accuracy, credibility, and reliability.

**Responsibilities**:
- Verify all factual claims and statements
- Check statistics, data points, and numbers for accuracy
- Validate cited sources are credible and relevant
- Assess content for potential misinformation
- Evaluate overall credibility and trustworthiness
- Check for consistency in terminology

**Output**: Accuracy scorecard with factual issues categorized by severity and corrections.

### 5. Final Reviewer (`final_reviewer`)

**Role**: Perform final quality review before publication.

**Responsibilities**:
- Verify all requirements from original brief are met
- Ensure all previous reviewer feedback has been addressed
- Assess overall content quality and consistency
- Confirm content is ready for publication
- Provide final approval or rejection

**Output**: Final approval status with quality score and publication readiness assessment.

## Workflow Flow

```
User Input
    ↓
[Requirements Collector] → Structured Brief
    ↓
[Content Writer] → Initial Draft
    ↓
[SEO Reviewer] → SEO-Optimized Draft
    ↓
[Accuracy Reviewer] → Fact-Checked Draft
    ↓
[Final Reviewer] → Approved Content
    ↓
Publication Ready
```

## Usage

These personas can be loaded into the PilotFrame control plane and used to create workflows that orchestrate blog post creation. Each persona provides structured instructions that guide AI agents through their specific responsibilities.

## Tags

All personas are tagged with `blog-post` for easy filtering, plus their specific role tags:
- `requirements_collector`: `requirements`, `planning`
- `content_writer`: `writing`, `content`
- `seo_reviewer`: `seo`, `review`, `optimization`
- `accuracy_reviewer`: `accuracy`, `fact-checking`, `review`
- `final_reviewer`: `review`, `quality`, `final`

