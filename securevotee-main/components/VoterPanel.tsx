import React, { useEffect, useState, useMemo } from 'react';
import { getSupabase } from '../services/supabase';
import { Candidate, Voter, VoteResult } from '../types';
import {
    Check, Loader2, LogOut, Briefcase, Vote, Users,
    Lock, Trophy, Heart, Clock, ChevronDown, Share, X
} from 'lucide-react';
import { Echo } from './Echo';
interface VoterPanelProps {
    voter: Voter;
    onLogout: () => void;
    onVoteComplete: () => void;
}
type SelectedVotes = Record<string, string>;
type Tab = 'ballot' | 'results' | 'socials' | 'club-elections';
export const VoterPanel: React.FC<VoterPanelProps> = ({ voter, onLogout, onVoteComplete }) => {
    const [activeTab, setActiveTab] = useState<Tab>('ballot');
    const [candidates, setCandidates] = useState<Candidate[]>([]);
    const [results, setResults] = useState<VoteResult[]>([]);
    const [isResultsPublic, setIsResultsPublic] = useState(false);
    const [isBallotHidden, setIsBallotHidden] = useState(false);
    const [startDate, setStartDate] = useState<Date | null>(null);
    const [selectedVotes, setSelectedVotes] = useState<SelectedVotes>({});
    const [submitting, setSubmitting] = useState(false);
    const [showIntroModal, setShowIntroModal] = useState(true);
    const [loading, setLoading] = useState(true);
    const [likingIds, setLikingIds] = useState<Set<string>>(new Set());
    const [expandedManifestos, setExpandedManifestos] = useState<Set<string>>(new Set());
    const [likedCandidates, setLikedCandidates] = useState<Set<string>>(new Set());
    // Club states
    const [clubs, setClubs] = useState<{ id: string; name: string }[]>([]);
    const [clubMode, setClubMode] = useState(false);
    const [currentClub, setCurrentClub] = useState<{ id: string; name: string } | null>(null);
    const [clubVoter, setClubVoter] = useState<Voter | null>(null);
    const [clubCandidates, setClubCandidates] = useState<Candidate[]>([]);
    const [clubResults, setClubResults] = useState<VoteResult[]>([]);
    const [isClubResultsPublic, setIsClubResultsPublic] = useState(false);
    const [isClubBallotHidden, setIsClubBallotHidden] = useState(false);
    const [clubStartDate, setClubStartDate] = useState<Date | null>(null);
    const [clubSelectedVotes, setClubSelectedVotes] = useState<SelectedVotes>({});
    const [clubSubmitting, setClubSubmitting] = useState(false);
    const [clubMemberInputs, setClubMemberInputs] = useState<Record<string, string>>({});
    const [clubExpandedManifestos, setClubExpandedManifestos] = useState<Set<string>>(new Set());
    const [clubLikedCandidates, setClubLikedCandidates] = useState<Set<string>>(new Set());
    const [animatingLikes, setAnimatingLikes] = useState<Set<string>>(new Set());
    const [clubAnimatingLikes, setClubAnimatingLikes] = useState<Set<string>>(new Set());
    const [selectedStoryIndex, setSelectedStoryIndex] = useState<number | null>(null);
    const supabase = getSupabase();
    // Fetch data
    useEffect(() => {
        const fetchData = async () => {
            if (!supabase) return;
            try {
                const { data: config } = await supabase
                    .from('election_config')
                    .select('is_results_public, is_ballot_hidden, start_date')
                    .maybeSingle();
                if (config) {
                    setIsResultsPublic(config.is_results_public);
                    setIsBallotHidden(config.is_ballot_hidden);
                    setStartDate(config.start_date ? new Date(config.start_date) : null);
                }
                const { data: candData } = await supabase
                    .from('candidates')
                    .select('*, like_count')
                    .order('position')
                    .order('name');
                if (candData) setCandidates(candData as Candidate[]);
                const { data: resData } = await supabase
                    .from('results')
                    .select('candidate_name, vote_count, position');
                if (resData) setResults(resData as VoteResult[]);
                // Fetch clubs
                const { data: clubsData } = await supabase
                    .from('clubs')
                    .select('id, name')
                    .order('name');
                if (clubsData) setClubs(clubsData);
                // Fetch liked candidates for main
                const { data: likesData } = await supabase
                    .from('candidate_likes')
                    .select('candidate_id')
                    .eq('voter_id', voter.id);
                if (likesData) setLikedCandidates(new Set(likesData.map(l => l.candidate_id)));
            } catch (err) {
                console.error('Error loading data:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [supabase, voter.id]);
    // Fetch club-specific data
    useEffect(() => {
        if (!clubMode || !currentClub || !supabase || !clubVoter) return;
        const fetchClubData = async () => {
            try {
                const { data: config } = await supabase
                    .from('club_configs')
                    .select('is_results_public, is_ballot_hidden, start_date')
                    .eq('club_id', currentClub.id)
                    .maybeSingle();
                if (config) {
                    setIsClubResultsPublic(config.is_results_public);
                    setIsClubBallotHidden(config.is_ballot_hidden);
                    setClubStartDate(config.start_date ? new Date(config.start_date) : null);
                }
                const { data: candData } = await supabase
                    .from('club_candidates')
                    .select('*, like_count')
                    .eq('club_id', currentClub.id)
                    .order('position')
                    .order('name');
                if (candData) setClubCandidates(candData as Candidate[]);
                const { data: resData } = await supabase
                    .from('club_results')
                    .select('candidate_name, vote_count, position')
                    .eq('club_id', currentClub.id);
                if (resData) setClubResults(resData as VoteResult[]);
                // Fetch liked for club
                const { data: clubLikesData } = await supabase
                    .from('club_candidate_likes')
                    .select('candidate_id')
                    .eq('voter_code', clubVoter.code);
                if (clubLikesData) setClubLikedCandidates(new Set(clubLikesData.map(l => l.candidate_id)));
            } catch (err) {
                console.error('Error loading club data:', err);
            }
        };
        fetchClubData();
    }, [clubMode, currentClub, supabase, clubVoter]);
    // Auto-switch tab after voting (main)
    useEffect(() => {
        if (voter.has_voted && activeTab === 'ballot') {
            if (isResultsPublic) {
                setActiveTab('results');
            } else {
                setActiveTab('socials');
            }
        }
    }, [voter.has_voted, isResultsPublic, activeTab]);
    const candidatesByPosition = useMemo(() => {
        return candidates.reduce((acc, candidate) => {
            const position = candidate.position || 'Unassigned';
            if (!acc[position]) acc[position] = [];
            acc[position].push(candidate);
            return acc;
        }, {} as Record<string, Candidate[]>);
    }, [candidates]);
    const allPositions = Object.keys(candidatesByPosition);
    const allPositionsVoted = allPositions.every(pos => selectedVotes[pos]);
    const handleSelect = (position: string, candidateId: string) => {
        if (!voter.has_voted) {
            setSelectedVotes(prev => ({ ...prev, [position]: candidateId }));
        }
    };
    const handleVote = async () => {
        if (voter.has_voted || !allPositionsVoted || !supabase) return;
        setSubmitting(true);
        const votesToInsert = Object.entries(selectedVotes).map(([position, candidate_id]) => ({
            candidate_id,
            voter_code: voter.code,
            position
        }));
        try {
            const { error: voteError } = await supabase.from('votes').insert(votesToInsert);
            if (voteError) throw voteError;
            await supabase
                .from('voters')
                .update({ has_voted: true })
                .eq('code', voter.code);
            onVoteComplete();
            if (isResultsPublic) {
                setActiveTab('results');
            } else {
                setActiveTab('socials');
            }
        } catch (error: any) {
            alert('Failed to submit vote: ' + (error.message || 'Try again.'));
        } finally {
            setSubmitting(false);
        }
    };
    const resultsByPosition = useMemo(() => {
        return results.reduce((acc, res) => {
            if (!acc[res.position]) acc[res.position] = [];
            acc[res.position].push(res);
            return acc;
        }, {} as Record<string, VoteResult[]>);
    }, [results]);
    // Club helpers
    const clubCandidatesByPosition = useMemo(() => {
        return clubCandidates.reduce((acc, candidate) => {
            const position = candidate.position || 'Unassigned';
            if (!acc[position]) acc[position] = [];
            acc[position].push(candidate);
            return acc;
        }, {} as Record<string, Candidate[]>);
    }, [clubCandidates]);
    const clubAllPositions = Object.keys(clubCandidatesByPosition);
    const clubAllPositionsVoted = clubAllPositions.every(pos => clubSelectedVotes[pos]);
    const handleClubSelect = (position: string, candidateId: string) => {
        if (clubVoter && !clubVoter.has_voted) {
            setClubSelectedVotes(prev => ({ ...prev, [position]: candidateId }));
        }
    };
    const handleClubVote = async () => {
        if (!clubVoter || clubVoter.has_voted || !clubAllPositionsVoted || !supabase || !currentClub) return;
        setClubSubmitting(true);
        const votesToInsert = Object.entries(clubSelectedVotes).map(([position, candidate_id]) => ({
            candidate_id,
            voter_code: clubVoter.code,
            position,
            club_id: currentClub.id
        }));
        try {
            const { error: voteError } = await supabase.from('club_votes').insert(votesToInsert);
            if (voteError) throw voteError;
            await supabase
                .from('club_voters')
                .update({ has_voted: true })
                .eq('id', clubVoter.id);
            // Refresh club voter
            const { data: updatedVoter } = await supabase.from('club_voters').select('*').eq('id', clubVoter.id).single();
            if (updatedVoter) setClubVoter(updatedVoter as Voter);
            if (isClubResultsPublic) {
                setActiveTab('results');
            } else {
                setActiveTab('socials');
            }
        } catch (error: any) {
            alert('Failed to submit club vote: ' + (error.message || 'Try again.'));
        } finally {
            setClubSubmitting(false);
        }
    };
    const clubResultsByPosition = useMemo(() => {
        return clubResults.reduce((acc, res) => {
            if (!acc[res.position]) acc[res.position] = [];
            acc[res.position].push(res);
            return acc;
        }, {} as Record<string, VoteResult[]>);
    }, [clubResults]);
    // Auto-switch for club
    useEffect(() => {
        if (clubMode && clubVoter?.has_voted && activeTab === 'ballot') {
            if (isClubResultsPublic) {
                setActiveTab('results');
            } else {
                setActiveTab('socials');
            }
        }
    }, [clubMode, clubVoter?.has_voted, isClubResultsPublic, activeTab]);
    // Check if election has started (main or club)
    const hasElectionStarted = (isClub: boolean = false) => {
        const now = new Date();
        const electionStart = isClub ? clubStartDate : startDate;
        return !electionStart || now >= electionStart;
    };
    const toggleManifesto = (id: string, isClub: boolean = false) => {
        const setExpanded = isClub ? setClubExpandedManifestos : setExpandedManifestos;
        setExpanded(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) {
                newSet.delete(id);
            } else {
                newSet.add(id);
            }
            return newSet;
        });
    };
    const handleCandidateLike = async (candidateId: string, isFromImage: boolean = false, isClub: boolean = false) => {
        const isLiking = likingIds.has(candidateId);
        const setLiked = isClub ? setClubLikedCandidates : setLikedCandidates;
        const liked = isClub ? clubLikedCandidates : likedCandidates;
        const setCandidatesFunc = isClub ? setClubCandidates : setCandidates;
        const voterId = isClub ? clubVoter?.code : voter.id;
        const table = isClub ? 'club_candidate_likes' : 'candidate_likes';
        const voterField = isClub ? 'voter_code' : 'voter_id';
        if (isLiking || liked.has(candidateId)) return;
        setLikingIds(prev => new Set([...prev, candidateId]));
        if (isFromImage) {
            const setAnimating = isClub ? setClubAnimatingLikes : setAnimatingLikes;
            setAnimating(prev => new Set([...prev, candidateId]));
            setTimeout(() => {
                setAnimating(p => {
                    const n = new Set(p);
                    n.delete(candidateId);
                    return n;
                });
            }, 800);
        }
        try {
            const { error } = await supabase!
                .from(table)
                .insert({
                    candidate_id: candidateId,
                    [voterField]: voterId
                });
            if (error) {
                if (error.code === '23505') {
                    alert("You already liked this manifesto!");
                } else {
                    console.error(error);
                    alert("Failed to like.");
                }
                return;
            }
            setCandidatesFunc(prev => prev.map(c =>
                c.id === candidateId
                    ? { ...c, like_count: (c.like_count || 0) + 1 }
                    : c
            ));
            setLiked(prev => new Set([...prev, candidateId]));
        } catch (err) {
            console.error(err);
        } finally {
            setLikingIds(p => {
                const n = new Set(p);
                n.delete(candidateId);
                return n;
            });
        }
    };
    const currentCandidates = clubMode ? clubCandidates : candidates;
    const selectedCandidate = selectedStoryIndex !== null ? currentCandidates[selectedStoryIndex] : null;
    let touchStartX = 0;
    const handleTouchStart = (e: React.TouchEvent) => {
        touchStartX = e.changedTouches[0].screenX;
    };
    const handleTouchEnd = (e: React.TouchEvent) => {
        const touchEndX = e.changedTouches[0].screenX;
        const delta = touchStartX - touchEndX;
        if (Math.abs(delta) > 50) {
            if (delta > 0) { // swipe left -> next
                setSelectedStoryIndex(prev => prev !== null && prev < currentCandidates.length - 1 ? prev + 1 : prev);
            } else { // swipe right -> prev
                setSelectedStoryIndex(prev => prev !== null && prev > 0 ? prev - 1 : prev);
            }
        }
    };
    if (loading) {
        return (
            <div className="min-h-screen bg-white flex items-center justify-center">
                <Loader2 className="animate-spin text-blue-500" size={56} />
            </div>
        );
    }
    return (
        <>
            {/* Intro Modal */}
            {!voter.has_voted && showIntroModal && (
                <div className="fixed inset-0 bg-gray-100/70 backdrop-blur-md z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-10 text-center border border-gray-200">
                        <div className="mx-auto w-24 h-24 bg-gradient-to-r from-gray-100 to-gray-200 rounded-full flex items-center justify-center mb-6">
                            <Vote size={48} className="text-blue-500" />
                        </div>
                        <h1 className="text-4xl font-black text-black mb-4">Campus Vote 3.0</h1>
                        <p className="text-lg text-gray-700 mb-8">Please review all candidates and vote wisely.</p>
                        <p className="text-sm text-gray-600 mb-8">
                            Voter Code: <span className="font-mono bg-gray-100 px-3 py-1 rounded">{voter.code}</span>
                        </p>
                        <button
                            onClick={() => setShowIntroModal(false)}
                            className="w-full py-5 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-bold rounded-2xl text-xl transition border border-gray-200"
                        >
                            Start Voting
                        </button>
                    </div>
                </div>
            )}
            {/* Story Viewing Modal */}
            {selectedCandidate && (
                <div 
                    className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4" 
                    onClick={() => setSelectedStoryIndex(null)}
                    onTouchStart={handleTouchStart}
                    onTouchEnd={handleTouchEnd}
                >
                    <div className="relative max-w-3xl w-full h-[80vh] flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
                        <img 
                            src={selectedCandidate.image_url} 
                            alt={selectedCandidate.name} 
                            className="max-w-full max-h-full object-contain"
                            onError={(e) => (e.currentTarget.src = '/placeholder.png')}
                        />
                        <button 
                            onClick={() => setSelectedStoryIndex(null)} 
                            className="absolute top-4 right-4 text-white hover:text-blue-500"
                        >
                            <X size={32} />
                        </button>
                    </div>
                </div>
            )}
            <div className="min-h-screen bg-white flex flex-col md:flex-row">
                {/* Desktop Sidebar */}
                <aside className="hidden md:flex flex-col w-64 bg-gradient-to-b from-gray-100 to-gray-200 text-black shadow-2xl border-r border-gray-200">
                    <div className="p-6 border-b border-gray-200">
                        <h1 className="text-xl font-bold text-black">Campus Vote 3.0</h1>
                        <p className="text-xs opacity-80 mt-1 text-gray-600">Voter Portal</p>
                    </div>
                    <nav className="flex-1 p-4 space-y-2">
                        <button
                            onClick={() => setActiveTab('ballot')}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition ${activeTab === 'ballot' ? 'bg-gray-200 shadow-lg text-black' : 'hover:bg-gray-200 text-gray-700'
                                }`}
                        >
                            <Vote size={20} />
                            <span>Ballot</span>
                            {voter.has_voted && <span className="ml-auto text-xs bg-gray-300 px-2 py-1 rounded text-black">✓ Voted</span>}
                        </button>
                        <button
                            onClick={() => setActiveTab('results')}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition ${activeTab === 'results'
                                    ? 'bg-gray-200 shadow-lg text-black'
                                    : !isResultsPublic
                                        ? 'opacity-60 cursor-not-allowed text-gray-500'
                                        : 'hover:bg-gray-200 text-gray-700'
                                }`}
                        >
                            <Trophy size={20} />
                            <span>Results</span>
                            {!isResultsPublic && <span className="ml-auto text-xs text-gray-500">Hidden</span>}
                        </button>
                        <button
                            onClick={() => setActiveTab('socials')}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition ${activeTab === 'socials' ? 'bg-gray-200 shadow-lg text-black' : 'hover:bg-gray-200 text-gray-700'
                                }`}
                        >
                            <Users size={20} />
                            <span>Socials</span>
                        </button>
                        <button
                            onClick={() => setActiveTab('club-elections')}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition ${activeTab === 'club-elections' ? 'bg-gray-200 shadow-lg text-black' : 'hover:bg-gray-200 text-gray-700'
                                }`}
                        >
                            <Users size={20} />
                            <span>Club Elections</span>
                        </button>
                    </nav>
                    <div className="p-4 border-t border-gray-200">
                        <button onClick={onLogout} className="w-full flex items-center gap-3 text-gray-700 hover:text-black">
                            <LogOut size={20} />
                            <span>Logout</span>
                        </button>
                    </div>
                </aside>
                {/* Main Content */}
                <div className="flex-1 flex flex-col">
                    <header className="bg-gradient-to-r from-gray-100 to-gray-200 text-black shadow-lg border-b border-gray-200">
                        <div className="max-w-5xl mx-auto px-6 py-5 flex items-center justify-between">
                            <div>
                                <h1 className="text-2xl font-bold text-black">
                                    {clubMode ? `${currentClub?.name} ` : ''}
                                    {activeTab === 'ballot' && 'Your Ballot'}
                                    {activeTab === 'results' && 'Election Results'}
                                    {activeTab === 'socials' && 'Candidate Profiles'}
                                    {activeTab === 'club-elections' && !clubMode && 'Club Elections'}
                                </h1>
                                <p className="text-sm opacity-90 mt-1 text-gray-600">Voter Code: {voter.code}</p>
                            </div>
                            <button onClick={onLogout} className="md:hidden text-black">
                                <LogOut size={24} />
                            </button>
                        </div>
                    </header>
                    <main className="flex-1 max-w-5xl mx-auto w-full p-6 pb-24 md:pb-6 relative bg-white text-black">
                        {/* BALLOT TAB (Main or Club) */}
                        {activeTab === 'ballot' && (
                            <div className="space-y-10 relative">
                                {clubMode ? (
                                    // Club Ballot
                                    isClubBallotHidden ? (
                                        <div className="text-center py-20 bg-gradient-to-b from-gray-100 to-gray-200 rounded-3xl border border-gray-200 shadow-xl">
                                            <Lock size={80} className="text-gray-400 mx-auto mb-6" />
                                            <p className="text-2xl font-bold text-black">Voting is Closed</p>
                                            <p className="text-gray-700 mt-4">The ballot has been hidden by the administrator.</p>
                                        </div>
                                    ) : !hasElectionStarted(true) ? (
                                        <div className="text-center py-20 bg-gradient-to-b from-gray-100 to-gray-200 rounded-3xl border border-gray-200 shadow-xl">
                                            <Clock size={80} className="text-gray-400 mx-auto mb-6" />
                                            <p className="text-2xl font-bold text-black">Election Not Started Yet</p>
                                            <p className="text-gray-700 mt-4">The club election will start on {clubStartDate?.toLocaleString()}.</p>
                                        </div>
                                    ) : (
                                        <>
                                            {clubVoter?.has_voted && (
                                                <div className="absolute inset-0 bg-white/40 backdrop-blur-sm rounded-3xl z-10 flex items-center justify-center">
                                                    <div className="bg-gradient-to-b from-gray-100 to-gray-200 rounded-3xl shadow-2xl p-10 text-center max-w-lg border border-gray-200">
                                                        <div className="mx-auto w-32 h-32 bg-gradient-to-r from-gray-100 to-gray-200 rounded-full flex items-center justify-center mb-6 border border-gray-200">
                                                            <Check size={64} className="text-blue-500" />
                                                        </div>
                                                        <h2 className="text-4xl font-black text-black mb-4">Thank You!</h2>
                                                        <p className="text-xl text-black">Your club vote has been recorded.</p>
                                                        <p className="text-lg text-gray-700 mt-4">View it below for reference.</p>
                                                    </div>
                                                </div>
                                            )}
                                            {Object.entries(clubCandidatesByPosition).map(([position, positionCandidates]) => (
                                                <div key={position} className="bg-gradient-to-b from-gray-100 to-gray-200 rounded-3xl shadow-xl border border-gray-200 p-8">
                                                    <h3 className="text-2xl font-bold text-black mb-8 flex items-center gap-3">
                                                        <Briefcase size={32} />
                                                        Vote for {position}
                                                    </h3>
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                        {positionCandidates.map((candidate) => {
                                                            const isSelected = clubSelectedVotes[position] === candidate.id;
                                                            return (
                                                                <div
                                                                    key={candidate.id}
                                                                    onClick={() => handleClubSelect(position, candidate.id)}
                                                                    className={`bg-white rounded-2xl border-2 transition-all shadow-md hover:shadow-xl relative flex flex-col items-center p-6 ${isSelected ? 'border-blue-500 ring-2 ring-blue-300' : 'border-gray-200'
                                                                        } ${clubVoter?.has_voted ? 'cursor-not-allowed opacity-90' : 'cursor-pointer'}`}
                                                                >
                                                                    <div className="w-40 h-40 mb-4 rounded-full overflow-hidden shadow-lg border border-gray-200">
                                                                        <img
                                                                            src={candidate.image_url}
                                                                            alt={candidate.name}
                                                                            className="w-full h-full object-cover"
                                                                            onError={(e) => (e.currentTarget.src = '/placeholder.png')}
                                                                        />
                                                                    </div>
                                                                    <h4 className="text-xl font-bold text-black text-center">{candidate.name}</h4>
                                                                    <div className="mt-4 flex items-center justify-center">
                                                                        <div className={`w-10 h-10 rounded-full border-2 flex items-center justify-center ${isSelected ? 'border-blue-500 bg-blue-500' : 'border-gray-200'
                                                                            }`}>
                                                                            {isSelected && <Check size={24} className="text-white" />}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            ))}
                                            {clubVoter && !clubVoter.has_voted && (
                                                <div className="fixed bottom-20 left-0 right-0 px-6 md:static md:mt-10 z-20 md:z-auto">
                                                    <div className="max-w-xl mx-auto">
                                                        <button
                                                            onClick={handleClubVote}
                                                            disabled={!clubAllPositionsVoted || clubSubmitting}
                                                            className={`w-full py-5 rounded-2xl font-black text-xl transition-all shadow-2xl ${clubAllPositionsVoted && !clubSubmitting
                                                                    ? 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white'
                                                                    : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                                                                }`}
                                                        >
                                                            {clubSubmitting ? 'Submitting Vote...' : 'Submit Final Ballot'}
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </>
                                    )
                                ) : (
                                    // Main Ballot
                                    isBallotHidden ? (
                                        <div className="text-center py-20 bg-gradient-to-b from-gray-100 to-gray-200 rounded-3xl border border-gray-200 shadow-xl">
                                            <Lock size={80} className="text-gray-400 mx-auto mb-6" />
                                            <p className="text-2xl font-bold text-black">Voting is Closed</p>
                                            <p className="text-gray-700 mt-4">The ballot has been hidden by the administrator.</p>
                                        </div>
                                    ) : !hasElectionStarted() ? (
                                        <div className="text-center py-20 bg-gradient-to-b from-gray-100 to-gray-200 rounded-3xl border border-gray-200 shadow-xl">
                                            <Clock size={80} className="text-gray-400 mx-auto mb-6" />
                                            <p className="text-2xl font-bold text-black">Election Not Started Yet</p>
                                            <p className="text-gray-700 mt-4">The election will start on {startDate?.toLocaleString()}.</p>
                                        </div>
                                    ) : (
                                        <>
                                            {voter.has_voted && (
                                                <div className="absolute inset-0 bg-white/40 backdrop-blur-sm rounded-3xl z-10 flex items-center justify-center">
                                                    <div className="bg-gradient-to-b from-gray-100 to-gray-200 rounded-3xl shadow-2xl p-10 text-center max-w-lg border border-gray-200">
                                                        <div className="mx-auto w-32 h-32 bg-gradient-to-r from-gray-100 to-gray-200 rounded-full flex items-center justify-center mb-6 border border-gray-200">
                                                            <Check size={64} className="text-blue-500" />
                                                        </div>
                                                        <h2 className="text-4xl font-black text-black mb-4">Thank You!</h2>
                                                        <p className="text-xl text-black">Your vote has been recorded.</p>
                                                        <p className="text-lg text-gray-700 mt-4">View it below for reference.</p>
                                                    </div>
                                                </div>
                                            )}
                                            {Object.entries(candidatesByPosition).map(([position, positionCandidates]) => (
                                                <div key={position} className="bg-gradient-to-b from-gray-100 to-gray-200 rounded-3xl shadow-xl border border-gray-200 p-8">
                                                    <h3 className="text-2xl font-bold text-black mb-8 flex items-center gap-3">
                                                        <Briefcase size={32} />
                                                        Vote for {position}
                                                    </h3>
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                        {positionCandidates.map((candidate) => {
                                                            const isSelected = selectedVotes[position] === candidate.id;
                                                            return (
                                                                <div
                                                                    key={candidate.id}
                                                                    onClick={() => handleSelect(position, candidate.id)}
                                                                    className={`bg-white rounded-2xl border-2 transition-all shadow-md hover:shadow-xl relative flex flex-col items-center p-6 ${isSelected ? 'border-blue-500 ring-2 ring-blue-300' : 'border-gray-200'
                                                                        } ${voter.has_voted ? 'cursor-not-allowed opacity-90' : 'cursor-pointer'}`}
                                                                >
                                                                    <div className="w-40 h-40 mb-4 rounded-full overflow-hidden shadow-lg border border-gray-200">
                                                                        <img
                                                                            src={candidate.image_url}
                                                                            alt={candidate.name}
                                                                            className="w-full h-full object-cover"
                                                                            onError={(e) => (e.currentTarget.src = '/placeholder.png')}
                                                                        />
                                                                    </div>
                                                                    <h4 className="text-xl font-bold text-black text-center">{candidate.name}</h4>
                                                                    <div className="mt-4 flex items-center justify-center">
                                                                        <div className={`w-10 h-10 rounded-full border-2 flex items-center justify-center ${isSelected ? 'border-blue-500 bg-blue-500' : 'border-gray-200'
                                                                            }`}>
                                                                            {isSelected && <Check size={24} className="text-white" />}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            ))}
                                            {!voter.has_voted && (
                                                <div className="fixed bottom-20 left-0 right-0 px-6 md:static md:mt-10 z-20 md:z-auto">
                                                    <div className="max-w-xl mx-auto">
                                                        <button
                                                            onClick={handleVote}
                                                            disabled={!allPositionsVoted || submitting}
                                                            className={`w-full py-5 rounded-2xl font-black text-xl transition-all shadow-2xl ${allPositionsVoted && !submitting
                                                                    ? 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white'
                                                                    : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                                                                }`}
                                                        >
                                                            {submitting ? 'Submitting Vote...' : 'Submit Final Ballot'}
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </>
                                    )
                                )}
                            </div>
                        )}
                        {/* RESULTS TAB (Main or Club) */}
                        {activeTab === 'results' && (
                            <div className="space-y-8 py-6">
                                {clubMode ? (
                                    // Club Results
                                    isClubResultsPublic ? (
                                        Object.entries(clubResultsByPosition).length > 0 ? (
                                            Object.entries(clubResultsByPosition).map(([position, posResults]) => {
                                                const sorted = [...posResults].sort((a, b) => b.vote_count - a.vote_count);
                                                const maxVotes = sorted[0]?.vote_count || 0;
                                                const winners = sorted.filter(r => r.vote_count === maxVotes);
                                                return (
                                                    <div key={position} className="bg-gradient-to-b from-gray-100 to-gray-200 rounded-3xl shadow-xl border border-gray-200 overflow-hidden">
                                                        <div className="bg-gray-100 text-black px-6 py-4 border-b border-gray-200">
                                                            <h3 className="text-xl font-bold flex items-center gap-3">
                                                                <Briefcase size={24} />
                                                                {position}
                                                            </h3>
                                                        </div>
                                                        <div className="p-6 space-y-4">
                                                            {sorted.map((result, index) => {
                                                                const isWinner = result.vote_count === maxVotes;
                                                                return (
                                                                    <div
                                                                        key={result.candidate_name}
                                                                        className={`flex items-center justify-between gap-4 p-4 rounded-xl ${isWinner
                                                                                ? 'bg-gray-200 border border-blue-500'
                                                                                : 'bg-white border border-gray-200'
                                                                            }`}
                                                                    >
                                                                        <div className="flex items-center gap-3">
                                                                            {isWinner && <Trophy size={20} className="text-blue-500" />}
                                                                            <h4 className="text-lg font-semibold text-black">
                                                                                {result.candidate_name}
                                                                                {isWinner && winners.length > 1 && ' (Tie)'}
                                                                            </h4>
                                                                        </div>
                                                                        <div className="flex items-center gap-4">
                                                                            <p className="text-xl font-bold text-black">
                                                                                {result.vote_count} votes
                                                                            </p>
                                                                            <span className="text-2xl font-bold text-blue-400">
                                                                                #{index + 1}
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                );
                                            })
                                        ) : (
                                            <div className="text-center py-20 bg-gradient-to-b from-gray-100 to-gray-200 rounded-3xl border border-gray-200 shadow-xl">
                                                <Trophy size={80} className="text-gray-400 mx-auto mb-6" />
                                                <p className="text-xl text-gray-700">No votes recorded yet.</p>
                                            </div>
                                        )
                                    ) : (
                                        <div className="text-center py-20 bg-gradient-to-b from-gray-100 to-gray-200 rounded-3xl border border-gray-200 shadow-xl">
                                            <Lock size={80} className="text-gray-400 mx-auto mb-6" />
                                            <p className="text-2xl font-bold text-black">Results are Hidden</p>
                                            <p className="text-gray-700 mt-4">The administrator will make results public soon.</p>
                                        </div>
                                    )
                                ) : (
                                    // Main Results
                                    isResultsPublic ? (
                                        Object.entries(resultsByPosition).length > 0 ? (
                                            Object.entries(resultsByPosition).map(([position, posResults]) => {
                                                const sorted = [...posResults].sort((a, b) => b.vote_count - a.vote_count);
                                                const maxVotes = sorted[0]?.vote_count || 0;
                                                const winners = sorted.filter(r => r.vote_count === maxVotes);
                                                return (
                                                    <div key={position} className="bg-gradient-to-b from-gray-100 to-gray-200 rounded-3xl shadow-xl border border-gray-200 overflow-hidden">
                                                        <div className="bg-gray-100 text-black px-6 py-4 border-b border-gray-200">
                                                            <h3 className="text-xl font-bold flex items-center gap-3">
                                                                <Briefcase size={24} />
                                                                {position}
                                                            </h3>
                                                        </div>
                                                        <div className="p-6 space-y-4">
                                                            {sorted.map((result, index) => {
                                                                const isWinner = result.vote_count === maxVotes;
                                                                return (
                                                                    <div
                                                                        key={result.candidate_name}
                                                                        className={`flex items-center justify-between gap-4 p-4 rounded-xl ${isWinner
                                                                                ? 'bg-gray-200 border border-blue-500'
                                                                                : 'bg-white border border-gray-200'
                                                                            }`}
                                                                    >
                                                                        <div className="flex items-center gap-3">
                                                                            {isWinner && <Trophy size={20} className="text-blue-500" />}
                                                                            <h4 className="text-lg font-semibold text-black">
                                                                                {result.candidate_name}
                                                                                {isWinner && winners.length > 1 && ' (Tie)'}
                                                                            </h4>
                                                                        </div>
                                                                        <div className="flex items-center gap-4">
                                                                            <p className="text-xl font-bold text-black">
                                                                                {result.vote_count} votes
                                                                            </p>
                                                                            <span className="text-2xl font-bold text-blue-400">
                                                                                #{index + 1}
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                );
                                            })
                                        ) : (
                                            <div className="text-center py-20 bg-gradient-to-b from-gray-100 to-gray-200 rounded-3xl border border-gray-200 shadow-xl">
                                                <Trophy size={80} className="text-gray-400 mx-auto mb-6" />
                                                <p className="text-xl text-gray-700">No votes recorded yet.</p>
                                            </div>
                                        )
                                    ) : (
                                        <div className="text-center py-20 bg-gradient-to-b from-gray-100 to-gray-200 rounded-3xl border border-gray-200 shadow-xl">
                                            <Lock size={80} className="text-gray-400 mx-auto mb-6" />
                                            <p className="text-2xl font-bold text-black">Results are Hidden</p>
                                            <p className="text-gray-700 mt-4">The administrator will make results public soon.</p>
                                        </div>
                                    )
                                )}
                            </div>
                        )}
                        {/* SOCIALS TAB (Main or Club) */}
                        {activeTab === 'socials' && (
                            <div className="py-8">
                                <div className="mb-6">
                                    <h2 className="text-lg font-semibold mb-2 text-black">Stories</h2>
                                    <div className="flex overflow-x-auto space-x-3 pb-2">
                                        {currentCandidates.map((candidate, index) => (
                                            <div 
                                                key={`story-${candidate.id}`} 
                                                className="flex flex-col items-center flex-shrink-0 w-20 cursor-pointer"
                                                onClick={() => setSelectedStoryIndex(index)}
                                            >
                                                <div className="w-16 h-16 rounded-full overflow-hidden border-4 border-blue-500">
                                                    <img 
                                                        src={candidate.image_url} 
                                                        alt={candidate.name} 
                                                        className="w-full h-full object-cover"
                                                        onError={(e) => (e.currentTarget.src = '/placeholder.png')}
                                                    />
                                                </div>
                                                <p className="text-xs mt-1 text-black truncate w-full text-center">{candidate.name.split(' ')[0]}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                                    {clubMode ? (
                                        // Club Socials
                                        clubCandidates.length > 0 ? (
                                            clubCandidates.map((candidate) => {
                                                const isLiking = likingIds.has(candidate.id);
                                                const localLikes = candidate.like_count || 0;
                                                const isExpanded = clubExpandedManifestos.has(candidate.id);
                                                const isLiked = clubLikedCandidates.has(candidate.id);
                                                const handleShare = async () => {
                                                    const shareData = {
                                                        title: `${candidate.name} - ${candidate.position}`,
                                                        text: candidate.manifesto || 'Check out this candidate!',
                                                        url: window.location.href,
                                                    };
                                                    if (navigator.share) {
                                                        try {
                                                            await navigator.share(shareData);
                                                        } catch (err) {
                                                            console.error('Share failed:', err);
                                                        }
                                                    } else {
                                                        // Fallback: Copy to clipboard
                                                        const shareText = `\( {shareData.title}\n \){shareData.text}\n${shareData.url}`;
                                                        try {
                                                            await navigator.clipboard.writeText(shareText);
                                                            alert('Candidate info copied to clipboard!');
                                                        } catch (err) {
                                                            console.error('Copy failed:', err);
                                                            alert('Failed to copy. Please copy manually: ' + shareText);
                                                        }
                                                    }
                                                };
                                                return (
                                                    <div key={candidate.id} className="bg-white rounded-lg overflow-hidden shadow-sm border border-gray-200">
                                                        <div className="p-3 flex items-center border-b border-gray-200">
                                                            <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-100 flex-shrink-0">
                                                                <img
                                                                    src={candidate.image_url}
                                                                    alt={candidate.name}
                                                                    className="w-full h-full object-cover"
                                                                    onError={(e) => (e.currentTarget.src = '/placeholder.png')}
                                                                />
                                                            </div>
                                                            <div className="ml-3">
                                                                <h3 className="font-semibold text-black">{candidate.name}</h3>
                                                                <p className="text-sm text-gray-600">{candidate.position}</p>
                                                            </div>
                                                        </div>
                                                        <div className="relative">
                                                            <img
                                                                src={candidate.image_url}
                                                                alt={candidate.name}
                                                                className="w-full max-h-[70vh] object-contain bg-white cursor-pointer"
                                                                onError={(e) => (e.currentTarget.src = '/placeholder.png')}
                                                                onClick={() => handleCandidateLike(candidate.id, true, true)}
                                                            />
                                                            {clubAnimatingLikes.has(candidate.id) && (
                                                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                                                    <Heart size={80} className="text-pink-500 animate-[scale-0-to-1.5_0.8s_ease-out]" />
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div className="p-4 space-y-3">
                                                            <div className="flex items-center space-x-6">
                                                                <button
                                                                    onClick={() => handleCandidateLike(candidate.id, false, true)}
                                                                    disabled={isLiking}
                                                                    className="hover:opacity-80 transition disabled:opacity-50"
                                                                >
                                                                    <Heart size={24} className={`${isLiked ? 'text-pink-500 fill-pink-500' : 'text-gray-600'}`} />
                                                                </button>
                                                                <button
                                                                    onClick={handleShare}
                                                                    className="hover:opacity-80 transition"
                                                                >
                                                                    <Share size={24} className="text-gray-600" />
                                                                </button>
                                                            </div>
                                                            <p className="font-semibold text-black">{localLikes} likes</p>
                                                            <p className={`text-gray-700 text-base leading-relaxed ${isExpanded ? '' : 'line-clamp-3'}`}>
                                                                {candidate.manifesto || 'No manifesto provided.'}
                                                            </p>
                                                            {candidate.manifesto && candidate.manifesto.split('. ').length > 3 && (
                                                                <button
                                                                    onClick={() => toggleManifesto(candidate.id, true)}
                                                                    className="text-gray-500 hover:text-gray-700 font-medium text-sm"
                                                                >
                                                                    {isExpanded ? 'less' : 'more'}
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })
                                        ) : (
                                            <p className="col-span-full text-center text-gray-700 py-20 text-xl">
                                                No candidates available.
                                            </p>
                                        )
                                    ) : (
                                        // Main Socials
                                        candidates.length > 0 ? (
                                            candidates.map((candidate) => {
                                                const isLiking = likingIds.has(candidate.id);
                                                const localLikes = candidate.like_count || 0;
                                                const isExpanded = expandedManifestos.has(candidate.id);
                                                const isLiked = likedCandidates.has(candidate.id);
                                                const handleShare = async () => {
                                                    const shareData = {
                                                        title: `${candidate.name} - ${candidate.position}`,
                                                        text: candidate.manifesto || 'Check out this candidate!',
                                                        url: window.location.href,
                                                    };
                                                    if (navigator.share) {
                                                        try {
                                                            await navigator.share(shareData);
                                                        } catch (err) {
                                                            console.error('Share failed:', err);
                                                        }
                                                    } else {
                                                        // Fallback: Copy to clipboard
                                                        const shareText = `\( {shareData.title}\n \){shareData.text}\n${shareData.url}`;
                                                        try {
                                                            await navigator.clipboard.writeText(shareText);
                                                            alert('Candidate info copied to clipboard!');
                                                        } catch (err) {
                                                            console.error('Copy failed:', err);
                                                            alert('Failed to copy. Please copy manually: ' + shareText);
                                                        }
                                                    }
                                                };
                                                return (
                                                    <div key={candidate.id} className="bg-white rounded-lg overflow-hidden shadow-sm border border-gray-200">
                                                        <div className="p-3 flex items-center border-b border-gray-200">
                                                            <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-100 flex-shrink-0">
                                                                <img
                                                                    src={candidate.image_url}
                                                                    alt={candidate.name}
                                                                    className="w-full h-full object-cover"
                                                                    onError={(e) => (e.currentTarget.src = '/placeholder.png')}
                                                                />
                                                            </div>
                                                            <div className="ml-3">
                                                                <h3 className="font-semibold text-black">{candidate.name}</h3>
                                                                <p className="text-sm text-gray-600">{candidate.position}</p>
                                                            </div>
                                                        </div>
                                                        <div className="relative">
                                                            <img
                                                                src={candidate.image_url}
                                                                alt={candidate.name}
                                                                className="w-full max-h-[70vh] object-contain bg-white cursor-pointer"
                                                                onError={(e) => (e.currentTarget.src = '/placeholder.png')}
                                                                onClick={() => handleCandidateLike(candidate.id, true, false)}
                                                            />
                                                            {animatingLikes.has(candidate.id) && (
                                                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                                                    <Heart size={80} className="text-pink-500 animate-[scale-0-to-1.5_0.8s_ease-out]" />
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div className="p-4 space-y-3">
                                                            <div className="flex items-center space-x-6">
                                                                <button
                                                                    onClick={() => handleCandidateLike(candidate.id, false, false)}
                                                                    disabled={isLiking}
                                                                    className="hover:opacity-80 transition disabled:opacity-50"
                                                                >
                                                                    <Heart size={24} className={`${isLiked ? 'text-pink-500 fill-pink-500' : 'text-gray-600'}`} />
                                                                </button>
                                                                <button
                                                                    onClick={handleShare}
                                                                    className="hover:opacity-80 transition"
                                                                >
                                                                    <Share size={24} className="text-gray-600" />
                                                                </button>
                                                            </div>
                                                            <p className="font-semibold text-black">{localLikes} likes</p>
                                                            <p className={`text-gray-700 text-base leading-relaxed ${isExpanded ? '' : 'line-clamp-3'}`}>
                                                                {candidate.manifesto || 'No manifesto provided.'}
                                                            </p>
                                                            {candidate.manifesto && candidate.manifesto.split('. ').length > 3 && (
                                                                <button
                                                                    onClick={() => toggleManifesto(candidate.id)}
                                                                    className="text-gray-500 hover:text-gray-700 font-medium text-sm"
                                                                >
                                                                    {isExpanded ? 'less' : 'more'}
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })
                                        ) : (
                                            <p className="col-span-full text-center text-gray-700 py-20 text-xl">
                                                No candidates available.
                                            </p>
                                        )
                                    )}
                                </div>
                            </div>
                        )}
                        {/* CLUB ELECTIONS TAB */}
                        {activeTab === 'club-elections' && (
                            <div className="space-y-12 py-8">
                                {clubMode ? (
                                    // Redirect to ballot/results/socials based on activeTab, but since we set activeTab to 'ballot' on enter, and auto-switch, it's handled above
                                    null // Placeholder, as ballot/results/socials handle clubMode
                                ) : (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                        {clubs.length > 0 ? (
                                            clubs.map((club) => (
                                                <div key={club.id} className="bg-gradient-to-b from-gray-100 to-gray-200 rounded-3xl shadow-2xl border border-gray-200 p-6 flex flex-col justify-between">
                                                    <h3 className="text-xl font-bold text-black mb-4">{club.name}</h3>
                                                    <input
                                                        type="text"
                                                        placeholder="Enter your Member Number"
                                                        value={clubMemberInputs[club.id] || ''}
                                                        onChange={(e) => setClubMemberInputs(prev => ({ ...prev, [club.id]: e.target.value }))}
                                                        className="w-full py-3 px-4 bg-white rounded-2xl border border-gray-200 focus:border-blue-500 outline-none text-base mb-4 text-black placeholder-gray-400"
                                                    />
                                                    <button
                                                        onClick={async () => {
                                                            const code = clubMemberInputs[club.id];
                                                            if (!code || !supabase) {
                                                                alert('Please enter your member number.');
                                                                return;
                                                            }
                                                            try {
                                                                const { data: clubVoterData, error } = await supabase
                                                                    .from('club_voters')
                                                                    .select('*')
                                                                    .eq('club_id', club.id)
                                                                    .eq('code', code)
                                                                    .maybeSingle();
                                                                if (error || !clubVoterData) {
                                                                    alert('Invalid member number for this club.');
                                                                    return;
                                                                }
                                                                setCurrentClub(club);
                                                                setClubVoter(clubVoterData as Voter);
                                                                setClubMode(true);
                                                                setActiveTab('ballot'); // Start with ballot
                                                            } catch (err) {
                                                                console.error(err);
                                                                alert('Error accessing club election.');
                                                            }
                                                        }}
                                                        className="w-full py-4 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-bold rounded-2xl text-lg transition"
                                                    >
                                                        Enter Club Election
                                                    </button>
                                                </div>
                                            ))
                                        ) : (
                                            <p className="col-span-full text-center text-gray-700 py-20 text-xl">
                                                No clubs available.
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </main>
                    {/* Mobile Bottom Nav */}
                    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-gradient-to-b from-gray-100 to-gray-200 border-t border-gray-200 shadow-2xl z-50">
                        <div className="grid grid-cols-4 py-3">
                            <button
                                onClick={() => setActiveTab('ballot')}
                                className={`flex flex-col items-center py-2 relative ${activeTab === 'ballot' ? 'text-black' : 'text-gray-700'}`}
                            >
                                <Vote size={24} />
                                <span className="text-xs mt-1">Ballot</span>
                                {voter.has_voted && <Check size={14} className="absolute top-0 right-2 text-blue-500 bg-white rounded-full border border-blue-500" />}
                            </button>
                            <button
                                onClick={() => setActiveTab('results')}
                                className={`flex flex-col items-center py-2 relative ${activeTab === 'results' ? 'text-black' : 'text-gray-700'}`}
                            >
                                <Trophy size={24} />
                                <span className="text-xs mt-1">Results</span>
                                {!isResultsPublic && <Lock size={14} className="absolute top-0 right-2 text-gray-400 bg-white rounded-full border border-gray-200" />}
                            </button>
                            <button
                                onClick={() => setActiveTab('socials')}
                                className={`flex flex-col items-center py-2 ${activeTab === 'socials' ? 'text-black' : 'text-gray-700'}`}
                            >
                                <Users size={24} />
                                <span className="text-xs mt-1">Socials</span>
                            </button>
                            <button
                                onClick={() => setActiveTab('club-elections')}
                                className={`flex flex-col items-center py-2 ${activeTab === 'club-elections' ? 'text-black' : 'text-gray-700'}`}
                            >
                                <Users size={24} />
                                <span className="text-xs mt-1">Clubs</span>
                            </button>
                        </div>
                    </nav>
                </div>
            </div>
            <div className="fixed top-4 right-4 md:top-6 md:right-6 z-[9999] pointer-events-none">
                <div className="pointer-events-auto">
                    <Echo />
                </div>
            </div>
        </>
    );
};