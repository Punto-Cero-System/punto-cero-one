/**
 * ContentCard — dispatcher for the Intelligent Mixed Feed.
 *
 * Given a normalised ContentSource item (`{id, kind, title, ...}`) picks
 * the right visual component. Falls back to a plain BaseCard for unknown
 * kinds so we never crash the feed if the backend adds a new type.
 */
import React from 'react';
import NewsCard from './NewsCard';
import JobCard from './JobCard';
import EventCard from './EventCard';
import VideoCard from './VideoCard';
import CompanyCard from './CompanyCard';
import CommunityCard from './CommunityCard';
import MarketplaceCard from './MarketplaceCard';
import RepoCard from './RepoCard';
import DatasetCard from './DatasetCard';
import AiToolCard from './AiToolCard';
import PreviewCard from './PreviewCard';
import BaseCard from './BaseCard';
import FeedPostCard from '../FeedPostCard';

const REGISTRY = {
  news: NewsCard,
  job: JobCard,
  event: EventCard,
  video: VideoCard,
  company: CompanyCard,
  community: CommunityCard,
  marketplace: MarketplaceCard,
  repo: RepoCard,
  dataset: DatasetCard,
  ai_tool: AiToolCard,
};

/**
 * Convert a mixed-feed `user_post` item into the shape FeedPostCard
 * already knows how to render.
 */
const shapeAsPost = (item) => {
  const p = item.metadata?.post || {};
  const author = item.metadata?.author || {};
  return {
    id: p.id || item.id,
    author: {
      id: author.id || 'unknown',
      name: author.name || 'Miembro',
      picture: author.picture || null,
      headline: author.headline || null,
    },
    body: p.body || item.description || item.title || '',
    hashtags: p.hashtags || [],
    image_url: p.image_url || item.image || null,
    category_key: item.category || null,
    visibility: 'public',
    link_url: null,
    counts: p.counts || { reactions: 0, comments: 0, shares: 0, saves: 0, views: 0 },
    reactions_by_kind: {},
    my_reaction: null,
    my_saved: false,
    status: 'published',
    created_at: item.created_at || new Date().toISOString(),
    updated_at: item.created_at || new Date().toISOString(),
  };
};

const ContentCard = ({ item, layout = 'medium' }) => {
  if (!item || !item.kind) return null;
  if (item.kind === 'user_post') {
    return <FeedPostCard post={shapeAsPost(item)} />;
  }
  // Wave 12 Fase 7 — layout='preview' → tarjeta compacta con CTA a la
  // página especializada (Noticias, Empleos, Eventos, …).
  if (layout === 'preview') {
    return <PreviewCard item={item} />;
  }
  const Component = REGISTRY[item.kind];
  if (Component) return <Component item={item} layout={layout} />;
  return (
    <BaseCard
      testid={`card-generic-${item.id}`}
      badgeLabel={item.kind}
      title={item.title}
      description={item.description}
    />
  );
};

export default ContentCard;
