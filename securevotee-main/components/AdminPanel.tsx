import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { getSupabase, getSupabaseAdmin } from '../services/supabase';
import { Voter, VoteResult, Candidate } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts';
import {
    Users, Ticket, Plus, Trash2, RefreshCw, LogOut, CheckCircle, Save, X,
    Briefcase, Crop, Loader2, Download, Trophy, Clock, Shield, LayoutDashboard,
    FileText, Globe, AlertCircle, Menu,
    Settings, Eye
} from 'lucide-react';
import ReactCrop, { Crop as CropType, PixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { getCroppedImage } from '../utils/cropImageHelper';

interface AdminPanelProps {
    onLogout: () => void;
}

interface AdminLog {
    id: string;
    action_type: string;
    details: string;
    created_at: string;
}

const IMAGE_ASPECT_RATIO = 1;

export const AdminPanel: React.FC<AdminPanelProps> = ({ onLogout }) => {
    // --- State Management ---
    const [activeTab, setActiveTab] = useState<'overview' | 'voters' | 'candidates' | 'settings' | 'clubs' | 'logs' | 'monitor'>('overview');
    const [results, setResults] = useState<VoteResult[]>([]);
    const [voters, setVoters] = useState<Voter[]>([]);
    const [candidates, setCandidates] = useState<Candidate[]>([]);
    const [logs, setLogs] = useState<AdminLog[]>([]);
    const [isLoadingData, setIsLoadingData] = useState(false);
    const [generateCount, setGenerateCount] = useState(5);
    // Organization & Election Config
    const [orgName, setOrgName] = useState('Loading...');
    const [electionTitle, setElectionTitle] = useState('Loading...');
    const [isResultsPublic, setIsResultsPublic] = useState(false);
    const [isBallotHidden, setIsBallotHidden] = useState(false);
  
    // Candidate Management State
    const [showAddCandidate, setShowAddCandidate] = useState(false);
    const [newCandidate, setNewCandidate] = useState({ name: '', manifesto: '', position: '' });
    const [mainCroppedImageFile, setMainCroppedImageFile] = useState<File | null>(null);
    const [mainImagePreviewUrl, setMainImagePreviewUrl] = useState<string | null>(null);
    const [isSavingCandidate, setIsSavingCandidate] = useState(false);
    // edit settings
    const [settings, setSettings] = useState({ id: '', org: '', elect: '' });
    // Cropper Modal State
    const [showCropper, setShowCropper] = useState(false);
    const [imageToCropUrl, setImageToCropUrl] = useState<string | null>(null);
    const [cropMode, setCropMode] = useState<'main' | 'club' | null>(null);
    // Position-specific State
    const [availablePositions, setAvailablePositions] = useState<string[]>([]);
    // Club states
    const [clubs, setClubs] = useState<{ id: string; name: string }[]>([]);
    const [selectedClub, setSelectedClub] = useState<{ id: string; name: string } | null>(null);
    const [clubActiveTab, setClubActiveTab] = useState<'overview' | 'voters' | 'candidates' | 'settings'>('overview');
    const [clubVoters, setClubVoters] = useState<Voter[]>([]);
    const [clubCandidates, setClubCandidates] = useState<Candidate[]>([]);
    const [clubResults, setClubResults] = useState<VoteResult[]>([]);
    const [clubIsResultsPublic, setClubIsResultsPublic] = useState(false);
    const [clubIsBallotHidden, setClubIsBallotHidden] = useState(false);
    const [showAddClubCandidate, setShowAddClubCandidate] = useState(false);
    const [clubNewCandidate, setClubNewCandidate] = useState({ name: '', manifesto: '', position: '' });
    const [clubAvailablePositions, setClubAvailablePositions] = useState<string[]>([]);
    const [clubCroppedImageFile, setClubCroppedImageFile] = useState<File | null>(null);
    const [clubImagePreviewUrl, setClubImagePreviewUrl] = useState<string | null>(null);
    // Ref for downloading the report
    const printRef = useRef<HTMLDivElement>(null);
    const supabase = getSupabase();
    // --- Helper: Log Admin Action ---
    const logAction = async (actionType: string, details: string) => {
        if (!supabase) return;
        try {
            await supabase.from('admin_logs').insert({
                action_type: actionType,
                details: details
            });
            // Refresh logs silently
            const { data } = await supabase.from('admin_logs').select('*').order('created_at', { ascending: false }).limit(50);
            if (data) setLogs(data);
        } catch (error) {
            console.error("Failed to log action:", error);
        }
    };
    // --- Fetch Data ---
    const fetchData = useCallback(async () => {
        if (!supabase) return;
        setIsLoadingData(true);
        try {
            // 1. Fetch Config
            const { data: config } = await supabase.from('election_config').select('*').maybeSingle();
            if (config) {
                setOrgName(config.org_name);
                setElectionTitle(config.election_title);
                setIsResultsPublic(config.is_results_public);
                setIsBallotHidden(config.is_ballot_hidden);
                setSettings({
                    id: config.id || '', // assuming election_config has an 'id' column
                    org: config.org_name || '',
                    elect: config.election_title || ''
                });
            }
            // 2. Fetch Voters
            const { data: votersData } = await supabase.from('voters').select('*').order('created_at', { ascending: false });
            if (votersData) setVoters(votersData as Voter[]);
            // 3. Fetch Candidates
            const { data: candidatesData } = await supabase.from('candidates').select('*').order('position').order('name');
            if (candidatesData) {
                const fetchedCandidates = candidatesData as Candidate[];
                setCandidates(fetchedCandidates);
                const positions = Array.from(new Set(fetchedCandidates.map(c => c.position).filter(p => p)));
                setAvailablePositions(positions);
            }
            // 4. Fetch Results
            const { data: resultsData } = await supabase.from('results').select('candidate_name, vote_count, position');
            if (resultsData) setResults(resultsData as VoteResult[]);
            // 5. Fetch Logs
            const { data: logsData } = await supabase.from('admin_logs').select('*').order('created_at', { ascending: false }).limit(50);
            if (logsData) setLogs(logsData);
            // 6. Fetch Clubs
            const { data: clubsData } = await supabase.from('clubs').select('*').order('name');
            if (clubsData) setClubs(clubsData);
        } catch (error) {
            console.error("Error fetching admin data:", error);
            alert("Failed to fetch data. Check console.");
        } finally {
            setIsLoadingData(false);
        }
    }, [supabase]);
    useEffect(() => {
        fetchData();
    }, [fetchData]);
    // Fetch club-specific data
    useEffect(() => {
        if (!selectedClub || !supabase) return;
        const fetchClubData = async () => {
            try {
                const { data: config } = await supabase.from('club_configs').select('is_results_public, is_ballot_hidden').eq('club_id', selectedClub.id).maybeSingle();
                if (config) {
                    setClubIsResultsPublic(config.is_results_public);
                    setClubIsBallotHidden(config.is_ballot_hidden);
                }
                const { data: votersData } = await supabase.from('club_voters').select('*').eq('club_id', selectedClub.id);
                if (votersData) setClubVoters(votersData as Voter[]);
                const { data: candidatesData } = await supabase.from('club_candidates').select('*').eq('club_id', selectedClub.id).order('position').order('name');
                if (candidatesData) {
                    setClubCandidates(candidatesData as Candidate[]);
                    const positions = Array.from(new Set(candidatesData.map(c => c.position).filter(p => p)));
                    setClubAvailablePositions(positions);
                }
                const { data: resultsData } = await supabase.from('club_results').select('candidate_name, vote_count, position').eq('club_id', selectedClub.id);
                if (resultsData) setClubResults(resultsData as VoteResult[]);
            } catch (err) {
                console.error('Error loading club data:', err);
            }
        };
        fetchClubData();
    }, [selectedClub, supabase]);
    // Preview Effects
    useEffect(() => {
        if (!mainCroppedImageFile) {
            setMainImagePreviewUrl(null);
            return;
        }
        const newPreviewUrl = URL.createObjectURL(mainCroppedImageFile);
        setMainImagePreviewUrl(newPreviewUrl);
        return () => URL.revokeObjectURL(newPreviewUrl);
    }, [mainCroppedImageFile]);

    useEffect(() => {
        if (!clubCroppedImageFile) {
            setClubImagePreviewUrl(null);
            return;
        }
        const newPreviewUrl = URL.createObjectURL(clubCroppedImageFile);
        setClubImagePreviewUrl(newPreviewUrl);
        return () => URL.revokeObjectURL(newPreviewUrl);
    }, [clubCroppedImageFile]);
    // --- Toggle Results Visibility ---
    const toggleResultsPublic = async () => {
        if (!supabase) return;
        const newValue = !isResultsPublic;
        console.log('Debug: Updating results public to', newValue, 'with config id', settings.id);
      
        const { error } = await supabase
            .from('election_config')
            .update({ is_results_public: newValue })
            .eq('id', settings.id);
      
        if (!error) {
            setIsResultsPublic(newValue);
            logAction('TOGGLE_RESULTS', `Set results visibility to ${newValue ? 'PUBLIC' : 'HIDDEN'}`);
            console.log('Debug: Update succeeded, new state:', newValue);
        } else {
            console.error('Debug: Update failed:', error);
            alert("Failed to update settings. Check console for error.");
        }
    };
    const toggleBallotHidden = async () => {
        if (!supabase) return;
        const newValue = !isBallotHidden;
        console.log('Debug: Updating ballot hidden to', newValue, 'with config id', settings.id);
        const { error } = await supabase
            .from('election_config')
            .update({ is_ballot_hidden: newValue })
            .eq('id', settings.id);
   
        if (!error) {
            setIsBallotHidden(newValue);
            logAction('TOGGLE_BALLOT', `Set ballot visibility to ${newValue ? 'HIDDEN' : 'VISIBLE'}`);
            console.log('Debug: Update succeeded, new state:', newValue);
        } else {
            console.error('Debug: Update failed:', error);
            alert("Failed to update ballot visibility. Check console for error.");
        }
    };
    // --- Voter Management Logic ---
    const generateVoterCodes = async () => {
        if (!supabase) return;
        const newVoters = [];
        const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      
        for (let i = 0; i < generateCount; i++) {
            let code = '';
            for (let j = 0; j < 6; j++) {
                code += chars.charAt(Math.floor(Math.random() * chars.length));
            }
            newVoters.push({ code, has_voted: false });
        }
      
        const { error } = await supabase.from('voters').insert(newVoters);
        if (!error) {
            alert(`Successfully generated ${generateCount} new voter codes.`);
            logAction('GENERATE_CODES', `Generated ${generateCount} new voting codes.`);
            fetchData();
        } else {
            console.error('Debug: Voter code generation failed:', error);
            alert('Error generating codes. Check console.');
        }
    };
    const deleteVoter = async (id: string) => {
        if (!supabase || !confirm('Are you sure? This action cannot be undone.')) return;
        await supabase.from('voters').delete().match({ id });
        logAction('DELETE_VOTER', `Deleted voter ID: ${id}`);
        fetchData();
    };
    // --- Image Handling & Cropping Logic ---
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, mode: 'main' | 'club') => {
        const file = e.target.files ? e.target.files[0] : null;
        if (file) {
            if (mode === 'main') setMainCroppedImageFile(null);
            else setClubCroppedImageFile(null);
            setImageToCropUrl(URL.createObjectURL(file));
            setShowCropper(true);
            setCropMode(mode);
            e.target.value = '';
        }
    };
  
    const handleCropComplete = (file: File) => {
        if (cropMode === 'main') {
            setMainCroppedImageFile(file);
        } else if (cropMode === 'club') {
            setClubCroppedImageFile(file);
        }
        setShowCropper(false);
        setImageToCropUrl(null);
        setCropMode(null);
    };

    const clearMainCrop = () => {
        setMainCroppedImageFile(null);
        setMainImagePreviewUrl(null);
        setImageToCropUrl(null);
        setShowCropper(false);
        setCropMode(null);
    };

    const clearClubCrop = () => {
        setClubCroppedImageFile(null);
        setClubImagePreviewUrl(null);
        setImageToCropUrl(null);
        setShowCropper(false);
        setCropMode(null);
    };
    // --- Candidate Upload Logic (With Manifesto) ---
    const handleAddCandidate = async () => {
        if (!supabase) return;
        if (!newCandidate.name || !newCandidate.manifesto || !newCandidate.position) {
            alert("Name, manifesto, and position are required");
            return;
        }
        if (!mainCroppedImageFile) {
            alert("Please upload and crop a candidate image");
            return;
        }
        setIsSavingCandidate(true);
        try {
            const supabaseAdmin = getSupabaseAdmin();
            if (!supabaseAdmin) {
                alert("Configuration Error: Could not load Admin Client.");
                return;
            }
          
            const bucketName = 'candidate_images';
            const fileExtension = mainCroppedImageFile.type.split('/').pop() || 'jpeg';
            const positionSlug = newCandidate.position.toLowerCase().replace(/\s/g, '_');
            const nameSlug = newCandidate.name.toLowerCase().replace(/\s/g, '_');
            const timestamp = Date.now();
            const fileName = `${positionSlug}-${nameSlug}-${timestamp}.${fileExtension}`;
          
            const { error: uploadError } = await supabaseAdmin.storage
                .from(bucketName)
                .upload(fileName, mainCroppedImageFile, { cacheControl: '3600', upsert: false });
            if (uploadError) throw uploadError;
            const { data: publicUrlData } = supabase.storage.from(bucketName).getPublicUrl(fileName);
          
            // Insert with MANIFESTO
            const { error: insertError } = await supabase.from('candidates').insert({
                name: newCandidate.name,
                manifesto: newCandidate.manifesto,
                position: newCandidate.position,
                image_url: publicUrlData.publicUrl
            });
            if (insertError) throw insertError;
            logAction('ADD_CANDIDATE', `Added candidate ${newCandidate.name} for ${newCandidate.position}`);
            setNewCandidate({ name: '', manifesto: '', position: '' });
            setMainCroppedImageFile(null);
            setShowAddCandidate(false);
            fetchData();
        } catch (error: any) {
            console.error("Error adding candidate:", error);
            alert(`Failed to add candidate: ${error.message || error}`);
        } finally {
            setIsSavingCandidate(false);
        }
    };
    const deleteCandidate = async (candidate: Candidate) => {
        if (!confirm(`Are you sure you want to delete candidate: ${candidate.name}?`)) return;
        try {
            const supabaseAdmin = getSupabaseAdmin();
            if (!supabaseAdmin) return;
            const { error } = await supabaseAdmin.from('candidates').delete().match({ id: candidate.id });
            if (error) throw error;
            logAction('DELETE_CANDIDATE', `Deleted candidate: ${candidate.name}`);
            await fetchData();
        } catch (error: any) {
            alert(`Failed to delete: ${error.message}`);
        }
    };
    // --- Helpers ---
    const candidatesByPosition = useMemo(() => {
        return candidates.reduce((acc, candidate) => {
            const position = candidate.position || 'Unassigned';
            if (!acc[position]) acc[position] = [];
            acc[position].push(candidate);
            return acc;
        }, {} as Record<string, Candidate[]>);
    }, [candidates]);
    const getCandidateImageByName = (name: string) => {
        return candidates.find(c => c.name === name)?.image_url || null;
    };
  
    // Stats
    const totalVotedBallots = useMemo(() => voters.filter(v => v.has_voted).length, [voters]);
    const totalCandidateVotesRecorded = useMemo(() => results.reduce((acc, curr) => acc + curr.vote_count, 0), [results]);
    const participationRate = useMemo(() =>
        voters.length > 0 ? ((totalVotedBallots / voters.length) * 100).toFixed(1) : '0',
    [voters, totalVotedBallots]);
     const handleSaveSettings = async () => {
    const supabase = getSupabase();
    if (!supabase) return;
    try {
        const { error } = await supabase
            .from('election_config') // ← Correct table name
            .update({
                org_name: settings.org.trim(), // ← Correct column names
                election_title: settings.elect.trim()
            })
            .eq('id', settings.id); // ← Match the same row
        if (error) throw error;
        // Immediately update the UI so changes show without refresh
        setOrgName(settings.org.trim());
        setElectionTitle(settings.elect.trim());
        alert("Branding updated successfully!");
      
        // Log the action
        logAction('UPDATE_SETTINGS', `Updated branding to "${settings.org}" - "${settings.elect}"`);
        // Optional: refetch everything to be safe
        // fetchData();
    } catch (error: any) {
        console.error("Save settings error:", error);
        alert("Failed to save settings: " + (error.message || "Unknown error"));
    }
};
    // Download Logic
    const handleDownloadReport = async () => {
        if (!printRef.current) return;
        try {
            const html2canvas = (await import('html2canvas')).default;
            const canvas = await html2canvas(printRef.current, { backgroundColor: '#ffffff', scale: 2 });
            const data = canvas.toDataURL('image/png');
            const link = document.createElement('a');
            link.href = data;
            link.download = `Election_Results_${new Date().toISOString().split('T')[0]}.png`;
            link.click();
            logAction('DOWNLOAD_REPORT', 'Downloaded election results report');
        } catch (e) {
            alert("Error generating image.");
        }
    };
    // Club-specific functions
    const toggleClubResultsPublic = async () => {
        if (!supabase || !selectedClub) return;
        const newValue = !clubIsResultsPublic;
        console.log('Debug: Updating club results public to', newValue, 'for club_id', selectedClub.id);
        const { error } = await supabase
            .from('club_configs')
            .update({ is_results_public: newValue })
            .eq('club_id', selectedClub.id);
      
        if (!error) {
            setClubIsResultsPublic(newValue);
            logAction('TOGGLE_CLUB_RESULTS', `Set ${selectedClub.name} results visibility to ${newValue ? 'PUBLIC' : 'HIDDEN'}`);
            console.log('Debug: Club update succeeded, new state:', newValue);
        } else {
            console.error('Debug: Club update failed:', error);
            alert("Failed to update club settings. Check console.");
        }
    };
    const toggleClubBallotHidden = async () => {
        if (!supabase || !selectedClub) return;
        const newValue = !clubIsBallotHidden;
        console.log('Debug: Updating club ballot hidden to', newValue, 'for club_id', selectedClub.id);
        const { error } = await supabase
            .from('club_configs')
            .update({ is_ballot_hidden: newValue })
            .eq('club_id', selectedClub.id);
        if (!error) {
            setClubIsBallotHidden(newValue);
            logAction('TOGGLE_CLUB_BALLOT', `Set ${selectedClub.name} ballot visibility to ${newValue ? 'HIDDEN' : 'VISIBLE'}`);
            console.log('Debug: Club update succeeded, new state:', newValue);
        } else {
            console.error('Debug: Club update failed:', error);
            alert("Failed to update club ballot visibility. Check console.");
        }
    };
    const generateClubVoterCodes = async () => {
        if (!supabase || !selectedClub) return;
        const newVoters = [];
        const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      
        for (let i = 0; i < generateCount; i++) {
            let code = '';
            for (let j = 0; j < 6; j++) {
                code += chars.charAt(Math.floor(Math.random() * chars.length));
            }
            newVoters.push({ club_id: selectedClub.id, code, has_voted: false });
        }
      
        const { error } = await supabase.from('club_voters').insert(newVoters);
        if (!error) {
            alert(`Successfully generated ${generateCount} new member numbers for ${selectedClub.name}.`);
            logAction('GENERATE_CLUB_CODES', `Generated ${generateCount} member numbers for ${selectedClub.name}.`);
            console.log('Debug: Generation succeeded, refetching club voters');
            // Refetch club data
            const { data: votersData } = await supabase.from('club_voters').select('*').eq('club_id', selectedClub.id);
            console.log('Debug: Refetched votersData:', votersData);
            if (votersData) setClubVoters(votersData as Voter[]);
        } else {
            console.error('Debug: Club voter generation failed:', error);
            alert('Error generating codes. Check console.');
        }
    };
    const deleteClubVoter = async (id: string) => {
        if (!supabase || !selectedClub || !confirm('Are you sure? This action cannot be undone.')) return;
        await supabase.from('club_voters').delete().match({ id });
        logAction('DELETE_CLUB_VOTER', `Deleted voter ID: ${id} for club ${selectedClub.name}`);
        // Refetch
        const { data: votersData } = await supabase.from('club_voters').select('*').eq('club_id', selectedClub.id);
        if (votersData) setClubVoters(votersData as Voter[]);
    };
    const handleAddClubCandidate = async () => {
        if (!supabase || !selectedClub) return;
        if (!clubNewCandidate.name || !clubNewCandidate.manifesto || !clubNewCandidate.position) {
            alert("Name, manifesto, and position are required");
            return;
        }
        if (!clubCroppedImageFile) {
            alert("Please upload and crop a candidate image");
            return;
        }
        setIsSavingCandidate(true);
        try {
            const supabaseAdmin = getSupabaseAdmin();
            if (!supabaseAdmin) {
                alert("Configuration Error: Could not load Admin Client.");
                return;
            }
          
            const bucketName = 'candidate_images';
            const fileExtension = clubCroppedImageFile.type.split('/').pop() || 'jpeg';
            const positionSlug = clubNewCandidate.position.toLowerCase().replace(/\s/g, '_');
            const nameSlug = clubNewCandidate.name.toLowerCase().replace(/\s/g, '_');
            const timestamp = Date.now();
            const fileName = `${positionSlug}-${nameSlug}-${timestamp}.${fileExtension}`;
          
            const { error: uploadError } = await supabaseAdmin.storage
                .from(bucketName)
                .upload(fileName, clubCroppedImageFile, { cacheControl: '3600', upsert: false });
            if (uploadError) throw uploadError;
            const { data: publicUrlData } = supabase.storage.from(bucketName).getPublicUrl(fileName);
          
            // Insert with MANIFESTO and club_id
            const { error: insertError } = await supabase.from('club_candidates').insert({
                club_id: selectedClub.id,
                name: clubNewCandidate.name,
                manifesto: clubNewCandidate.manifesto,
                position: clubNewCandidate.position,
                image_url: publicUrlData.publicUrl
            });
            if (insertError) throw insertError;
            logAction('ADD_CLUB_CANDIDATE', `Added candidate ${clubNewCandidate.name} for ${clubNewCandidate.position} in ${selectedClub.name}`);
            setClubNewCandidate({ name: '', manifesto: '', position: '' });
            setClubCroppedImageFile(null);
            setShowAddClubCandidate(false);
            // Refetch club candidates
            const { data: candidatesData } = await supabase.from('club_candidates').select('*').eq('club_id', selectedClub.id).order('position').order('name');
            if (candidatesData) setClubCandidates(candidatesData as Candidate[]);
        } catch (error: any) {
            console.error("Error adding club candidate:", error);
            alert(`Failed to add candidate: ${error.message || error}`);
        } finally {
            setIsSavingCandidate(false);
        }
    };
    const deleteClubCandidate = async (candidate: Candidate) => {
        if (!supabase || !selectedClub || !confirm(`Are you sure you want to delete candidate: ${candidate.name}?`)) return;
        try {
            const { error } = await supabase.from('club_candidates').delete().match({ id: candidate.id });
            if (error) throw error;
            logAction('DELETE_CLUB_CANDIDATE', `Deleted candidate: ${candidate.name} from ${selectedClub.name}`);
            const { data: candidatesData } = await supabase.from('club_candidates').select('*').eq('club_id', selectedClub.id).order('position').order('name');
            if (candidatesData) setClubCandidates(candidatesData as Candidate[]);
        } catch (error: any) {
            alert(`Failed to delete: ${error.message}`);
        }
    };
    const handleSaveClubSettings = async () => {
        if (!supabase || !selectedClub) return;
        const newName = prompt('Enter new club name:', selectedClub.name);
        if (newName && newName !== selectedClub.name) {
            const { error } = await supabase.from('clubs').update({ name: newName }).eq('id', selectedClub.id);
            if (!error) {
                setSelectedClub({ ...selectedClub, name: newName });
                logAction('UPDATE_CLUB', `Updated club name to ${newName}`);
                fetchData();
                alert('Club name updated successfully!');
            } else {
                alert('Failed to update club name.');
            }
        }
    };
    // Club stats
    const clubTotalVotedBallots = useMemo(() => clubVoters.filter(v => v.has_voted).length, [clubVoters]);
    const clubTotalCandidateVotesRecorded = useMemo(() => clubResults.reduce((acc, curr) => acc + curr.vote_count, 0), [clubResults]);
    const clubParticipationRate = useMemo(() =>
        clubVoters.length > 0 ? ((clubTotalVotedBallots / clubVoters.length) * 100).toFixed(1) : '0',
    [clubVoters, clubTotalVotedBallots]);
    const clubCandidatesByPosition = useMemo(() => {
        return clubCandidates.reduce((acc, candidate) => {
            const position = candidate.position || 'Unassigned';
            if (!acc[position]) acc[position] = [];
            acc[position].push(candidate);
            return acc;
        }, {} as Record<string, Candidate[]>);
    }, [clubCandidates]);
    const getClubCandidateImageByName = (name: string) => {
        return clubCandidates.find(c => c.name === name)?.image_url || null;
    };
    // --- Render ---
    return (
        <div className="flex min-h-screen bg-gray-900 font-sans">
            {/* --- SIDEBAR --- */}
            <aside className="w-64 bg-black text-gray-300 flex flex-col sticky top-0 h-screen shadow-2xl z-20">
                <div className="p-6 border-b border-gray-800 bg-gray-950/30">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="bg-gray-800 p-2 rounded-lg backdrop-blur-sm">
                            <Shield size={24} className="text-gray-300" />
                        </div>
                        <div>
                            <h1 className="font-bold text-lg leading-tight">{orgName}</h1>
                            <p className="text-xs text-gray-500 font-medium tracking-wide">Admin Portal</p>
                        </div>
                    </div>
                </div>
              
                <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
                    {[
                        { id: 'overview', icon: <LayoutDashboard size={20} />, label: 'Overview' },
                        { id: 'voters', icon: <Users size={20} />, label: 'Voters' },
                        { id: 'candidates', icon: <Briefcase size={20} />, label: 'Candidates' },
                        { id: 'clubs', icon: <Users size={20} />, label: 'Clubs' },
                        { id: 'logs', icon: <Clock size={20} />, label: 'Audit Logs' },
                        { id: 'monitor', icon: <Eye size={20} />, label: 'Monitor' },
                    ].map((item) => (
                        <button
                            key={item.id}
                            onClick={() => setActiveTab(item.id as any)}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${
                                activeTab === item.id
                                ? 'bg-gray-800 text-white shadow-lg shadow-gray-900/50 translate-x-1'
                                : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                            }`}
                        >
                            {item.icon}
                            <span className="font-medium">{item.label}</span>
                            {activeTab === item.id && <div className="ml-auto w-1.5 h-1.5 bg-white rounded-full"></div>}
                        </button>
                    ))}
                </nav>
                <div className="p-4 border-t border-gray-800 bg-gray-950/30">
                    <button onClick={onLogout} className="flex items-center gap-3 text-gray-500 hover:text-white w-full px-4 py-3 rounded-xl hover:bg-gray-800/50 transition">
                        <LogOut size={20} />
                        <span className="font-medium">Logout</span>
                    </button>
                    <button
    onClick={() => setActiveTab('settings')}
    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
        activeTab === 'settings' ? 'bg-gray-800 text-gray-300 font-bold shadow-sm' : 'text-gray-500 hover:bg-gray-800'
    }`}
>
    <Settings size={20} />
    <span>Settings</span>
</button>
                </div>
            </aside>
            {/* --- MAIN CONTENT --- */}
            <main className="flex-1 overflow-y-auto bg-gray-900">
                {/* Header Bar */}
                <header className="bg-gray-800 text-gray-300 shadow-sm border-b border-gray-700 px-8 py-5 flex justify-between items-center sticky top-0 z-10">
                    <div>
                        <h2 className="text-2xl font-black text-gray-100 tracking-tight">{electionTitle}</h2>
                        <p className="text-sm text-gray-400 font-medium flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${isResultsPublic ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'}`}></span>
                            Status: {isResultsPublic ? 'Results Public' : 'Voting Active'}
                        </p>
                    </div>
                    <div className="flex gap-3">
                        <button onClick={fetchData} className="p-2 text-gray-500 hover:text-red-400 hover:bg-gray-700 rounded-lg transition" title="Refresh Data">
                            <RefreshCw size={20} className={isLoadingData ? 'animate-spin' : ''} />
                        </button>
                    </div>
                </header>
                <div className="p-8 max-w-7xl mx-auto space-y-8 text-gray-300">
                  
                    {/* --- OVERVIEW TAB --- */}
                    {activeTab === 'overview' && (
                        <div className="space-y-8 animate-in fade-in duration-500">
                            {/* Control Panel */}
                            <div className="bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-700 flex items-center justify-between">
                                <div>
                                    <h3 className="font-bold text-lg text-gray-100">Results Visibility</h3>
                                    <p className="text-sm text-gray-400">When enabled, voters will see the results chart instead of the ballot.</p>
                                </div>
                                <button
                                    onClick={toggleResultsPublic}
                                    className={`px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-all ${
                                        isResultsPublic
                                        ? 'bg-green-900 text-green-300 hover:bg-green-800'
                                        : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                                    }`}
                                >
                                    <Globe size={20} />
                                    {isResultsPublic ? 'Results are LIVE' : 'Results are HIDDEN'}
                                </button>
                            </div>
                            <div className="bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-700 flex items-center justify-between">
                                <div>
                                    <h3 className="font-bold text-lg text-gray-100">Ballot Visibility</h3>
                                    <p className="text-sm text-gray-400">Hide the ballot to prevent new votes (useful during result counting).</p>
                                </div>
                                <button
                                    onClick={toggleBallotHidden}
                                    className={`px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-all ${
                                        !isBallotHidden
                                            ? 'bg-green-900 text-green-300 hover:bg-green-800'
                                            : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                                    }`}
                                >
                                    <Globe size={20} />
                                    {isBallotHidden ? 'Ballot is HIDDEN' : 'Ballot is VISIBLE'}
                                </button>
                            </div>
                            {/* Download Report Button */}
                            <div className="flex justify-end">
                                <button
                                    onClick={handleDownloadReport}
                                    className="flex items-center gap-2 bg-red-800 hover:bg-red-900 text-gray-300 text-sm font-bold px-5 py-2.5 rounded-xl shadow-md hover:shadow-lg transition transform hover:-translate-y-0.5"
                                >
                                    <Download size={18} /> Download Official Report
                                </button>
                            </div>
                            {/* Report Capture Area */}
                            <div ref={printRef} className="space-y-8 p-8 bg-gray-800 rounded-3xl border-2 border-gray-700 shadow-sm">
                                {/* Stats Cards */}
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                                    {[
                                        { label: 'Registered Voters', value: voters.length, color: 'text-gray-100' },
                                        { label: 'Ballots Cast', value: totalVotedBallots, color: 'text-gray-100' },
                                        { label: 'Participation', value: `${participationRate}%`, color: 'text-red-400' },
                                        { label: 'Total Votes', value: totalCandidateVotesRecorded, color: 'text-gray-100' }
                                    ].map((stat, i) => (
                                        <div key={i} className="bg-gray-700 p-6 rounded-2xl border border-gray-600">
                                            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">{stat.label}</h3>
                                            <p className={`text-3xl font-black mt-2 ${stat.color}`}>{stat.value}</p>
                                        </div>
                                    ))}
                                </div>
                                {/* Results Charts */}
                                <div className="space-y-12">
                                    {availablePositions.map((position) => {
                                        const positionResults = results.filter(r => r.position === position);
                                        const sortedResults = [...positionResults].sort((a, b) => b.vote_count - a.vote_count);
                                        const maxVotes = sortedResults.length > 0 ? sortedResults[0].vote_count : 0;
                                        const winners = sortedResults.filter(r => r.vote_count === maxVotes);
                                        const isTie = winners.length > 1;
                                        return (
                                            <div key={position} className="bg-gray-800 border border-gray-700 rounded-2xl p-8 shadow-sm">
                                                <h3 className="text-xl font-bold text-gray-100 mb-6 flex items-center gap-2">
                                                    <Briefcase size={20} className="text-red-400" /> {position}
                                                </h3>
                                              
                                                <div className="flex flex-col lg:flex-row gap-10">
                                                    {/* Winners Circle */}
                                                    <div className="lg:w-1/3 space-y-4">
                                                        {winners.map((winner) => (
                                                            <div key={winner.candidate_name} className={`p-6 rounded-2xl border-2 text-center relative ${isTie ? 'bg-orange-900 border-orange-700' : 'bg-yellow-900 border-yellow-700'}`}>
                                                                <div className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold uppercase mb-4 ${isTie ? 'bg-orange-800 text-orange-300' : 'bg-yellow-800 text-yellow-300'}`}>
                                                                    <Trophy size={12} /> {isTie ? 'Tie' : 'Winner'}
                                                                </div>
                                                                <div className="w-24 h-24 mx-auto rounded-full border-4 border-gray-800 shadow-md overflow-hidden mb-3">
                                                                    <img src={getCandidateImageByName(winner.candidate_name) || '/placeholder.png'} alt={winner.candidate_name} className="w-full h-full object-cover" />
                                                                </div>
                                                                <h4 className="font-bold text-lg text-gray-100">{winner.candidate_name}</h4>
                                                                <p className="text-2xl font-black text-gray-100 mt-1">{winner.vote_count} <span className="text-sm font-normal text-gray-400">votes</span></p>
                                                            </div>
                                                        ))}
                                                        {winners.length === 0 && <p className="text-gray-500 italic">No votes yet.</p>}
                                                    </div>
                                                    {/* Bar Chart */}
                                                    <div className="flex-1 h-80">
                                                        <ResponsiveContainer width="100%" height="100%">
                                                            <BarChart data={sortedResults} margin={{ top: 20 }}>
                                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#4b5563" />
                                                                <XAxis dataKey="candidate_name" tickLine={false} axisLine={false} fontSize={12} tick={{fill: '#9ca3af'}} />
                                                                <YAxis tickLine={false} axisLine={false} fontSize={12} allowDecimals={false} tick={{fill: '#9ca3af'}} />
                                                                <Tooltip cursor={{ fill: '#374151' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)', backgroundColor: '#1f2937', color: '#f3f4f6' }} />
                                                                <Bar dataKey="vote_count" radius={[6, 6, 0, 0]} barSize={40}>
                                                                    {sortedResults.map((entry, idx) => (
                                                                        <Cell key={idx} fill={entry.vote_count === maxVotes ? (isTie ? '#c2410c' : '#ca8a04') : '#6b7280'} />
                                                                    ))}
                                                                    <LabelList dataKey="vote_count" position="top" style={{ fill: '#9ca3af', fontSize: '12px', fontWeight: 'bold' }} />
                                                                </Bar>
                                                            </BarChart>
                                                        </ResponsiveContainer>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}
                    {/* --- VOTERS TAB --- */}
                    {activeTab === 'voters' && (
                        <div className="bg-gray-800 rounded-2xl shadow-sm border border-gray-700 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="p-6 border-b border-gray-700 flex justify-between items-center bg-gray-900/50">
                                <div>
                                    <h3 className="font-bold text-lg text-gray-100">Voter Management</h3>
                                    <p className="text-sm text-gray-400">Generate access codes for students.</p>
                                </div>
                                <div className="flex gap-2">
                                    <input
                                        type="number"
                                        min="1" max="100"
                                        value={generateCount}
                                        onChange={(e) => setGenerateCount(parseInt(e.target.value))}
                                        className="w-20 px-3 py-2 border border-gray-600 rounded-lg text-sm bg-gray-900 text-gray-300"
                                    />
                                    <button onClick={generateVoterCodes} className="bg-red-800 hover:bg-red-900 text-gray-300 px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2">
                                        <Plus size={16} /> Generate Codes
                                    </button>
                                </div>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead className="bg-gray-900 border-b border-gray-700">
                                        <tr>
                                            <th className="p-4 text-xs font-bold text-gray-500 uppercase">Code</th>
                                            <th className="p-4 text-xs font-bold text-gray-500 uppercase">Status</th>
                                            <th className="p-4 text-xs font-bold text-gray-500 uppercase text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-700">
                                        {voters.map((voter) => (
                                            <tr key={voter.id} className="hover:bg-gray-700/30 transition">
                                                <td className="p-4 font-mono font-medium text-gray-300">{voter.code}</td>
                                                <td className="p-4">
                                                    {voter.has_voted ?
                                                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-green-900 text-green-300"><CheckCircle size={12}/> Voted</span> :
                                                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-yellow-900 text-yellow-300"><Ticket size={12}/> Pending</span>
                                                    }
                                                </td>
                                                <td className="p-4 text-right">
                                                    <button onClick={() => deleteVoter(voter.id)} className="text-gray-500 hover:text-red-400 transition p-2 hover:bg-gray-700 rounded-lg">
                                                        <Trash2 size={16} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                    {activeTab === 'settings' && (
    <div className="bg-gray-800 rounded-2xl shadow-sm border border-gray-700 p-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="mb-8">
            <h3 className="text-2xl font-bold text-gray-100 flex items-center gap-2">
                <Settings className="text-red-400" size={24} /> General Settings
            </h3>
            <p className="text-gray-400">Update branding and organization details.</p>
        </div>
        <div className="grid gap-6 max-w-lg">
            <div>
                <label className="block text-sm font-semibold text-gray-300 mb-2">Organization Name</label>
                <input
                    type="text"
                    value={settings.org}
                    onChange={(e) => setSettings({...settings, org: e.target.value})}
                    className="w-full p-3 border border-gray-600 rounded-xl focus:ring-2 focus:ring-red-500 outline-none bg-gray-900 text-gray-300"
                />
            </div>
            <div>
                <label className="block text-sm font-semibold text-gray-300 mb-2">Election Name</label>
                <input
                    type="text"
                    value={settings.elect}
                    onChange={(e) => setSettings({...settings, elect: e.target.value})}
                    className="w-full p-3 border border-gray-600 rounded-xl focus:ring-2 focus:ring-red-500 outline-none bg-gray-900 text-gray-300"
                />
            </div>
            <button
                onClick={handleSaveSettings}
                className="bg-red-800 text-gray-300 font-bold py-3 px-6 rounded-xl hover:bg-red-900 transition flex items-center justify-center gap-2"
            >
                <Save size={18} /> Update Branding
            </button>
        </div>
    </div>
)}
                    {/* --- CANDIDATES TAB --- */}
                    {activeTab === 'candidates' && (
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                            {/* Add Button */}
                            <div
                                onClick={() => setShowAddCandidate(true)}
                                className="mb-8 border-2 border-dashed border-gray-700 rounded-2xl p-8 flex flex-col items-center justify-center text-gray-500 cursor-pointer hover:bg-gray-800 hover:border-gray-500 transition group"
                            >
                                <div className="bg-gray-700 p-3 rounded-full mb-3 group-hover:scale-110 transition">
                                    <Plus size={32} className="text-red-400" />
                                </div>
                                <h3 className="font-bold text-red-400">Add New Candidate</h3>
                            </div>
                            {/* List */}
                            {Object.entries(candidatesByPosition).map(([position, list]) => (
                                <div key={position} className="mb-10">
                                    <h2 className="text-xl font-bold text-gray-100 mb-4 pl-2 border-l-4 border-red-400">{position}</h2>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                        {list.map(candidate => (
                                            <div key={candidate.id} className="bg-gray-800 rounded-2xl shadow-sm border border-gray-700 overflow-hidden flex flex-col hover:shadow-md transition">
                                                <div className="h-48 bg-gray-700 relative group">
                                                    <img src={candidate.image_url} alt={candidate.name} className="w-full h-full object-cover" />
                                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                                                        <button onClick={() => deleteCandidate(candidate)} className="bg-gray-800 text-red-400 p-3 rounded-full font-bold shadow-lg hover:scale-110 transition">
                                                            <Trash2 size={20} />
                                                        </button>
                                                    </div>
                                                </div>
                                                <div className="p-5 flex-1 flex flex-col">
                                                    <h3 className="text-lg font-bold text-gray-100">{candidate.name}</h3>
                                                    {/* Manifesto Preview */}
                                                    <div className="mt-3 text-sm text-gray-400 bg-gray-700 p-3 rounded-lg flex-1">
                                                        <p className="font-bold text-xs text-gray-500 uppercase mb-1 flex items-center gap-1">
                                                            <FileText size={10} /> Manifesto
                                                        </p>
                                                        <p className="line-clamp-3 italic">"{candidate.manifesto || candidate.description}"</p>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                            {/* Add Candidate Modal */}
                            {showAddCandidate && (
                                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                                    <div className="bg-gray-800 rounded-2xl shadow-2xl max-w-lg w-full p-6 animate-in zoom-in-95 duration-200 border border-gray-700">
                                        <div className="flex justify-between items-center mb-6">
                                            <h3 className="text-xl font-bold text-gray-100">New Candidate Profile</h3>
                                            <button onClick={() => { setShowAddCandidate(false); clearMainCrop(); }} className="text-gray-500 hover:text-gray-300"><X size={24} /></button>
                                        </div>
                                        <div className="space-y-4">
                                            <div>
                                                <label className="text-sm font-bold text-gray-300 block mb-1">Position</label>
                                                <input list="positions" className="w-full border border-gray-600 rounded-lg p-3 bg-gray-700 focus:bg-gray-600 focus:ring-2 focus:ring-red-500 outline-none transition text-gray-300"
                                                    value={newCandidate.position} onChange={e => setNewCandidate({...newCandidate, position: e.target.value})} placeholder="e.g. President" />
                                                <datalist id="positions">{availablePositions.map(p => <option key={p} value={p} />)}</datalist>
                                            </div>
                                            <div>
                                                <label className="text-sm font-bold text-gray-300 block mb-1">Full Name</label>
                                                <input className="w-full border border-gray-600 rounded-lg p-3 bg-gray-700 focus:bg-gray-600 focus:ring-2 focus:ring-red-500 outline-none transition text-gray-300"
                                                    value={newCandidate.name} onChange={e => setNewCandidate({...newCandidate, name: e.target.value})} placeholder="Candidate Name" />
                                            </div>
                                            <div>
                                                <label className="text-sm font-bold text-gray-300 block mb-1">Manifesto / Platform</label>
                                                <textarea className="w-full border border-gray-600 rounded-lg p-3 bg-gray-700 focus:bg-gray-600 focus:ring-2 focus:ring-red-500 outline-none transition text-gray-300" rows={4}
                                                    value={newCandidate.manifesto} onChange={e => setNewCandidate({...newCandidate, manifesto: e.target.value})} placeholder="Detailed policy platform..." />
                                            </div>
                                            <div>
                                                <label className="text-sm font-bold text-gray-300 block mb-2">Campaign Photo</label>
                                                <div className="flex items-center gap-4">
                                                    <label className="px-4 py-2 bg-gray-700 text-red-400 rounded-lg cursor-pointer font-bold hover:bg-gray-600 transition">
                                                        Choose File <input type="file" className="hidden" accept="image/*" onChange={(e) => handleFileChange(e, 'main')} />
                                                    </label>
                                                    {mainImagePreviewUrl && <img src={mainImagePreviewUrl} className="w-12 h-12 rounded-full object-cover border-2 border-gray-600" alt="Preview" />}
                                                </div>
                                            </div>
                                            <div className="flex justify-end gap-3 pt-4">
                                                <button onClick={() => { setShowAddCandidate(false); clearMainCrop(); }} className="px-5 py-2 text-gray-500 font-bold hover:bg-gray-700 rounded-lg">Cancel</button>
                                                <button onClick={handleAddCandidate} disabled={isSavingCandidate} className="px-6 py-2 bg-red-800 text-gray-300 font-bold rounded-lg hover:bg-red-900 flex items-center gap-2">
                                                    {isSavingCandidate ? <Loader2 className="animate-spin" /> : <Save size={18} />} Save Profile
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                    {/* --- CLUBS TAB --- */}
                    {activeTab === 'clubs' && (
                        <div className="space-y-8 animate-in fade-in duration-500">
                            <div className="flex justify-between items-center">
                                <h3 className="text-2xl font-bold text-gray-100 tracking-tight">Club Elections</h3>
                                <button
                                    onClick={async () => {
                                        const name = prompt('Enter new club name:');
                                        if (name && supabase) {
                                            const { data, error } = await supabase.from('clubs').insert({ name }).select().single();
                                            if (!error && data) {
                                                await supabase.from('club_configs').insert({ club_id: data.id });
                                                fetchData();
                                                logAction('CREATE_CLUB', `Created club: ${name}`);
                                            } else {
                                                alert('Error creating club');
                                            }
                                        }
                                    }}
                                    className="bg-red-800 hover:bg-red-900 text-gray-300 px-4 py-2 rounded-lg font-bold flex items-center gap-2"
                                >
                                    <Plus size={18} /> New Club
                                </button>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {clubs.map((club) => (
                                    <div key={club.id} className="bg-gray-800 rounded-2xl shadow-sm border border-gray-700 p-6">
                                        <h4 className="text-xl font-bold text-gray-100 mb-4">{club.name}</h4>
                                        <button
                                            onClick={() => {
                                                setSelectedClub(club);
                                                setClubActiveTab('overview');
                                            }}
                                            className="w-full bg-gray-700 text-red-400 py-2 rounded-lg font-bold hover:bg-gray-600 transition"
                                        >
                                            Manage Club
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    {/* --- ADMIN LOGS TAB --- */}
                    {activeTab === 'logs' && (
                        <div className="bg-gray-800 rounded-2xl shadow-sm border border-gray-700 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="p-6 border-b border-gray-700 bg-gray-900/50">
                                <h3 className="font-bold text-lg text-gray-100 flex items-center gap-2">
                                    <Clock className="text-red-400" size={20} /> System Audit Logs
                                </h3>
                                <p className="text-sm text-gray-400">Recent administrative actions.</p>
                            </div>
                            <div className="divide-y divide-gray-700">
                                {logs.length > 0 ? (
                                    logs.map((log) => (
                                        <div key={log.id} className="p-4 hover:bg-gray-700 flex items-center justify-between transition">
                                            <div className="flex items-center gap-4">
                                                <div className="bg-blue-900 p-2 rounded-full text-blue-400">
                                                    <AlertCircle size={16}/>
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold text-gray-100">{log.action_type.replace(/_/g, ' ')}</p>
                                                    <p className="text-xs text-gray-400">{log.details}</p>
                                                </div>
                                            </div>
                                            <span className="text-xs font-mono text-gray-500">
                                                {new Date(log.created_at).toLocaleString()}
                                            </span>
                                        </div>
                                    ))
                                ) : (
                                    <div className="p-8 text-center text-gray-500 italic">No logs found.</div>
                                )}
                            </div>
                        </div>
                    )}
                    {/* --- MONITOR TAB --- */}
                    {activeTab === 'monitor' && (
                        <div className="bg-gray-800 rounded-2xl shadow-sm border border-gray-700 p-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <h3 className="text-2xl font-bold text-gray-100 mb-6">Election Monitor</h3>
                            <div className="bg-gray-700 p-6 rounded-2xl border border-gray-600">
                                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Total Ballots Cast</h4>
                                <p className="text-4xl font-black mt-2 text-gray-100">{totalVotedBallots}</p>
                            </div>
                        </div>
                    )}
                </div>
            </main>
            {/* Club Management Modal */}
            {selectedClub && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-gray-800 rounded-2xl shadow-2xl max-w-4xl w-full h-[90vh] flex flex-col overflow-hidden border border-gray-700">
                        <div className="p-6 border-b border-gray-700 flex justify-between items-center bg-gray-900/50">
                            <h3 className="text-2xl font-bold text-gray-100">{selectedClub.name} Management</h3>
                            <button onClick={() => setSelectedClub(null)} className="text-gray-500 hover:text-red-400">
                                <X size={24} />
                            </button>
                        </div>
                        <nav className="flex gap-4 p-4 border-b border-gray-700 bg-gray-800">
                            <button
                                onClick={() => setClubActiveTab('overview')}
                                className={`px-4 py-2 rounded-lg font-medium ${clubActiveTab === 'overview' ? 'bg-red-800 text-gray-300' : 'bg-gray-700 text-gray-500 hover:bg-gray-600'}`}
                            >
                                Overview
                            </button>
                            <button
                                onClick={() => setClubActiveTab('voters')}
                                className={`px-4 py-2 rounded-lg font-medium ${clubActiveTab === 'voters' ? 'bg-red-800 text-gray-300' : 'bg-gray-700 text-gray-500 hover:bg-gray-600'}`}
                            >
                                Voters
                            </button>
                            <button
                                onClick={() => setClubActiveTab('candidates')}
                                className={`px-4 py-2 rounded-lg font-medium ${clubActiveTab === 'candidates' ? 'bg-red-800 text-gray-300' : 'bg-gray-700 text-gray-500 hover:bg-gray-600'}`}
                            >
                                Candidates
                            </button>
                            <button
                                onClick={() => setClubActiveTab('settings')}
                                className={`px-4 py-2 rounded-lg font-medium ${clubActiveTab === 'settings' ? 'bg-red-800 text-gray-300' : 'bg-gray-700 text-gray-500 hover:bg-gray-600'}`}
                            >
                                Settings
                            </button>
                        </nav>
                        <div className="flex-1 overflow-y-auto p-6 text-gray-300">
                            {/* Club Overview */}
                            {clubActiveTab === 'overview' && (
                                <div className="space-y-8">
                                    {/* Club Control Panel */}
                                    <div className="bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-700 flex items-center justify-between">
                                        <div>
                                            <h3 className="font-bold text-lg text-gray-100">Results Visibility</h3>
                                            <p className="text-sm text-gray-400">When enabled, club members will see the results.</p>
                                        </div>
                                        <button
                                            onClick={toggleClubResultsPublic}
                                            className={`px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-all ${
                                                clubIsResultsPublic
                                                ? 'bg-green-900 text-green-300 hover:bg-green-800'
                                                : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                                            }`}
                                        >
                                            <Globe size={20} />
                                            {clubIsResultsPublic ? 'Results are LIVE' : 'Results are HIDDEN'}
                                        </button>
                                    </div>
                                    <div className="bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-700 flex items-center justify-between">
                                        <div>
                                            <h3 className="font-bold text-lg text-gray-100">Ballot Visibility</h3>
                                            <p className="text-sm text-gray-400">Hide the ballot to prevent new votes (useful during result counting).</p>
                                        </div>
                                        <button
                                            onClick={toggleClubBallotHidden}
                                            className={`px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-all ${
                                                !clubIsBallotHidden
                                                    ? 'bg-green-900 text-green-300 hover:bg-green-800'
                                                    : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                                            }`}
                                        >
                                            <Globe size={20} />
                                            {clubIsBallotHidden ? 'Ballot is HIDDEN' : 'Ballot is VISIBLE'}
                                        </button>
                                    </div>
                                    {/* Club Stats Cards */}
                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                                        {[
                                            { label: 'Registered Members', value: clubVoters.length, color: 'text-gray-100' },
                                            { label: 'Ballots Cast', value: clubTotalVotedBallots, color: 'text-gray-100' },
                                            { label: 'Participation', value: `${clubParticipationRate}%`, color: 'text-red-400' },
                                            { label: 'Total Votes', value: clubTotalCandidateVotesRecorded, color: 'text-gray-100' }
                                        ].map((stat, i) => (
                                            <div key={i} className="bg-gray-700 p-6 rounded-2xl border border-gray-600">
                                                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">{stat.label}</h3>
                                                <p className={`text-3xl font-black mt-2 ${stat.color}`}>{stat.value}</p>
                                            </div>
                                        ))}
                                    </div>
                                    {/* Club Results Charts */}
                                    <div className="space-y-12">
                                        {clubAvailablePositions.map((position) => {
                                            const positionResults = clubResults.filter(r => r.position === position);
                                            const sortedResults = [...positionResults].sort((a, b) => b.vote_count - a.vote_count);
                                            const maxVotes = sortedResults.length > 0 ? sortedResults[0].vote_count : 0;
                                            const winners = sortedResults.filter(r => r.vote_count === maxVotes);
                                            const isTie = winners.length > 1;
                                            return (
                                                <div key={position} className="bg-gray-800 border border-gray-700 rounded-2xl p-8 shadow-sm">
                                                    <h3 className="text-xl font-bold text-gray-100 mb-6 flex items-center gap-2">
                                                        <Briefcase size={20} className="text-red-400" /> {position}
                                                    </h3>
                                                  
                                                    <div className="flex flex-col lg:flex-row gap-10">
                                                        {/* Winners Circle */}
                                                        <div className="lg:w-1/3 space-y-4">
                                                            {winners.map((winner) => (
                                                                <div key={winner.candidate_name} className={`p-6 rounded-2xl border-2 text-center relative ${isTie ? 'bg-orange-900 border-orange-700' : 'bg-yellow-900 border-yellow-700'}`}>
                                                                    <div className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold uppercase mb-4 ${isTie ? 'bg-orange-800 text-orange-300' : 'bg-yellow-800 text-yellow-300'}`}>
                                                                        <Trophy size={12} /> {isTie ? 'Tie' : 'Winner'}
                                                                    </div>
                                                                    <div className="w-24 h-24 mx-auto rounded-full border-4 border-gray-800 shadow-md overflow-hidden mb-3">
                                                                        <img src={getClubCandidateImageByName(winner.candidate_name) || '/placeholder.png'} alt={winner.candidate_name} className="w-full h-full object-cover" />
                                                                    </div>
                                                                    <h4 className="font-bold text-lg text-gray-100">{winner.candidate_name}</h4>
                                                                    <p className="text-2xl font-black text-gray-100 mt-1">{winner.vote_count} <span className="text-sm font-normal text-gray-400">votes</span></p>
                                                                </div>
                                                            ))}
                                                            {winners.length === 0 && <p className="text-gray-500 italic">No votes yet.</p>}
                                                        </div>
                                                        {/* Bar Chart */}
                                                        <div className="flex-1 h-80">
                                                            <ResponsiveContainer width="100%" height="100%">
                                                                <BarChart data={sortedResults} margin={{ top: 20 }}>
                                                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#4b5563" />
                                                                    <XAxis dataKey="candidate_name" tickLine={false} axisLine={false} fontSize={12} tick={{fill: '#9ca3af'}} />
                                                                    <YAxis tickLine={false} axisLine={false} fontSize={12} allowDecimals={false} tick={{fill: '#9ca3af'}} />
                                                                    <Tooltip cursor={{ fill: '#374151' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)', backgroundColor: '#1f2937', color: '#f3f4f6' }} />
                                                                    <Bar dataKey="vote_count" radius={[6, 6, 0, 0]} barSize={40}>
                                                                        {sortedResults.map((entry, idx) => (
                                                                            <Cell key={idx} fill={entry.vote_count === maxVotes ? (isTie ? '#c2410c' : '#ca8a04') : '#6b7280'} />
                                                                        ))}
                                                                        <LabelList dataKey="vote_count" position="top" style={{ fill: '#9ca3af', fontSize: '12px', fontWeight: 'bold' }} />
                                                                    </Bar>
                                                                </BarChart>
                                                            </ResponsiveContainer>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                            {/* Club Voters */}
                            {clubActiveTab === 'voters' && (
                                <div className="bg-gray-800 rounded-2xl shadow-sm border border-gray-700 overflow-hidden">
                                    <div className="p-6 border-b border-gray-700 flex justify-between items-center bg-gray-900/50">
                                        <div>
                                            <h3 className="font-bold text-lg text-gray-100">Member Management</h3>
                                            <p className="text-sm text-gray-400">Generate member numbers for club members.</p>
                                        </div>
                                        <div className="flex gap-2">
                                            <input
                                                type="number"
                                                min="1" max="100"
                                                value={generateCount}
                                                onChange={(e) => setGenerateCount(parseInt(e.target.value))}
                                                className="w-20 px-3 py-2 border border-gray-600 rounded-lg text-sm bg-gray-900 text-gray-300"
                                            />
                                            <button onClick={generateClubVoterCodes} className="bg-red-800 hover:bg-red-900 text-gray-300 px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2">
                                                <Plus size={16} /> Generate Member Numbers
                                            </button>
                                        </div>
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left">
                                            <thead className="bg-gray-900 border-b border-gray-700">
                                                <tr>
                                                    <th className="p-4 text-xs font-bold text-gray-500 uppercase">Code</th>
                                                    <th className="p-4 text-xs font-bold text-gray-500 uppercase">Status</th>
                                                    <th className="p-4 text-xs font-bold text-gray-500 uppercase text-right">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-700">
                                                {clubVoters.map((voter) => (
                                                    <tr key={voter.id} className="hover:bg-gray-700/30 transition">
                                                        <td className="p-4 font-mono font-medium text-gray-300">{voter.code}</td>
                                                        <td className="p-4">
                                                            {voter.has_voted ?
                                                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-green-900 text-green-300"><CheckCircle size={12}/> Voted</span> :
                                                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-yellow-900 text-yellow-300"><Ticket size={12}/> Pending</span>
                                                            }
                                                        </td>
                                                        <td className="p-4 text-right">
                                                            <button onClick={() => deleteClubVoter(voter.id)} className="text-gray-500 hover:text-red-400 transition p-2 hover:bg-gray-700 rounded-lg">
                                                                <Trash2 size={16} />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                            {/* Club Candidates */}
                            {clubActiveTab === 'candidates' && (
                                <div>
                                    {/* Add Button */}
                                    <div
                                        onClick={() => setShowAddClubCandidate(true)}
                                        className="mb-8 border-2 border-dashed border-gray-700 rounded-2xl p-8 flex flex-col items-center justify-center text-gray-500 cursor-pointer hover:bg-gray-800 hover:border-gray-500 transition group"
                                    >
                                        <div className="bg-gray-700 p-3 rounded-full mb-3 group-hover:scale-110 transition">
                                            <Plus size={32} className="text-red-400" />
                                        </div>
                                        <h3 className="font-bold text-red-400">Add New Club Candidate</h3>
                                    </div>
                                    {/* List */}
                                    {Object.entries(clubCandidatesByPosition).map(([position, list]) => (
                                        <div key={position} className="mb-10">
                                            <h2 className="text-xl font-bold text-gray-100 mb-4 pl-2 border-l-4 border-red-400">{position}</h2>
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                                {list.map(candidate => (
                                                    <div key={candidate.id} className="bg-gray-800 rounded-2xl shadow-sm border border-gray-700 overflow-hidden flex flex-col hover:shadow-md transition">
                                                        <div className="h-48 bg-gray-700 relative group">
                                                            <img src={candidate.image_url} alt={candidate.name} className="w-full h-full object-cover" />
                                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                                                                <button onClick={() => deleteClubCandidate(candidate)} className="bg-gray-800 text-red-400 p-3 rounded-full font-bold shadow-lg hover:scale-110 transition">
                                                                    <Trash2 size={20} />
                                                                </button>
                                                            </div>
                                                        </div>
                                                        <div className="p-5 flex-1 flex flex-col">
                                                            <h3 className="text-lg font-bold text-gray-100">{candidate.name}</h3>
                                                            {/* Manifesto Preview */}
                                                            <div className="mt-3 text-sm text-gray-400 bg-gray-700 p-3 rounded-lg flex-1">
                                                                <p className="font-bold text-xs text-gray-500 uppercase mb-1 flex items-center gap-1">
                                                                    <FileText size={10} /> Manifesto
                                                                </p>
                                                                <p className="line-clamp-3 italic">"{candidate.manifesto || candidate.description}"</p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                    {/* Add Club Candidate Modal */}
                                    {showAddClubCandidate && (
                                        <div className="fixed inset-0 bg-black/70 z-[60] flex items-center justify-center p-4">
                                            <div className="bg-gray-800 rounded-2xl shadow-2xl max-w-lg w-full p-6 animate-in zoom-in-95 duration-200 border border-gray-700">
                                                <div className="flex justify-between items-center mb-6">
                                                    <h3 className="text-xl font-bold text-gray-100">New Club Candidate Profile</h3>
                                                    <button onClick={() => { setShowAddClubCandidate(false); clearClubCrop(); }} className="text-gray-500 hover:text-gray-300"><X size={24} /></button>
                                                </div>
                                                <div className="space-y-4">
                                                    <div>
                                                        <label className="text-sm font-bold text-gray-300 block mb-1">Position</label>
                                                        <input list="club-positions" className="w-full border border-gray-600 rounded-lg p-3 bg-gray-700 focus:bg-gray-600 focus:ring-2 focus:ring-red-500 outline-none transition text-gray-300"
                                                            value={clubNewCandidate.position} onChange={e => setClubNewCandidate({...clubNewCandidate, position: e.target.value})} placeholder="e.g. President" />
                                                        <datalist id="club-positions">{clubAvailablePositions.map(p => <option key={p} value={p} />)}</datalist>
                                                    </div>
                                                    <div>
                                                        <label className="text-sm font-bold text-gray-300 block mb-1">Full Name</label>
                                                        <input className="w-full border border-gray-600 rounded-lg p-3 bg-gray-700 focus:bg-gray-600 focus:ring-2 focus:ring-red-500 outline-none transition text-gray-300"
                                                            value={clubNewCandidate.name} onChange={e => setClubNewCandidate({...clubNewCandidate, name: e.target.value})} placeholder="Candidate Name" />
                                                    </div>
                                                    <div>
                                                        <label className="text-sm font-bold text-gray-300 block mb-1">Manifesto / Platform</label>
                                                        <textarea className="w-full border border-gray-600 rounded-lg p-3 bg-gray-700 focus:bg-gray-600 focus:ring-2 focus:ring-red-500 outline-none transition text-gray-300" rows={4}
                                                            value={clubNewCandidate.manifesto} onChange={e => setClubNewCandidate({...clubNewCandidate, manifesto: e.target.value})} placeholder="Detailed policy platform..." />
                                                    </div>
                                                    <div>
                                                        <label className="text-sm font-bold text-gray-300 block mb-2">Campaign Photo</label>
                                                        <div className="flex items-center gap-4">
                                                            <label className="px-4 py-2 bg-gray-700 text-red-400 rounded-lg cursor-pointer font-bold hover:bg-gray-600 transition">
                                                                Choose File <input type="file" className="hidden" accept="image/*" onChange={(e) => handleFileChange(e, 'club')} />
                                                            </label>
                                                            {clubImagePreviewUrl && <img src={clubImagePreviewUrl} className="w-12 h-12 rounded-full object-cover border-2 border-gray-600" alt="Preview" />}
                                                        </div>
                                                    </div>
                                                    <div className="flex justify-end gap-3 pt-4">
                                                        <button onClick={() => { setShowAddClubCandidate(false); clearClubCrop(); }} className="px-5 py-2 text-gray-500 font-bold hover:bg-gray-700 rounded-lg">Cancel</button>
                                                        <button onClick={handleAddClubCandidate} disabled={isSavingCandidate} className="px-6 py-2 bg-red-800 text-gray-300 font-bold rounded-lg hover:bg-red-900 flex items-center gap-2">
                                                            {isSavingCandidate ? <Loader2 className="animate-spin" /> : <Save size={18} />} Save Profile
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                            {/* Club Settings */}
                            {clubActiveTab === 'settings' && (
                                <div className="space-y-6">
                                    <h3 className="text-xl font-bold text-gray-100">Club Settings</h3>
                                    <button
                                        onClick={handleSaveClubSettings}
                                        className="bg-red-800 text-gray-300 font-bold py-3 px-6 rounded-xl hover:bg-red-900 transition flex items-center gap-2"
                                    >
                                        <Save size={18} /> Update Club Name
                                    </button>
                                    <button
                                        onClick={async () => {
                                            if (confirm(`Are you sure you want to delete club: ${selectedClub.name}? This cannot be undone.`)) {
                                                if (supabase) {
                                                    const { error } = await supabase.from('clubs').delete().eq('id', selectedClub.id);
                                                    if (!error) {
                                                        setSelectedClub(null);
                                                        fetchData();
                                                        logAction('DELETE_CLUB', `Deleted club: ${selectedClub.name}`);
                                                    } else {
                                                        alert('Failed to delete club');
                                                    }
                                                }
                                            }
                                        }}
                                        className="bg-red-900 text-red-300 font-bold py-3 px-6 rounded-xl hover:bg-red-800 transition flex items-center gap-2"
                                    >
                                        <Trash2 size={18} /> Delete Club
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
            {/* Image Cropper Modal */}
            {showCropper && imageToCropUrl && (
                <ImageCropperModal
                    imageUrl={imageToCropUrl}
                    onCropComplete={handleCropComplete}
                    onCancel={() => setShowCropper(false)}
                />
            )}
        </div>
    );
};
// --- Helper Component: Image Cropper ---
interface ImageCropperModalProps {
    imageUrl: string;
    onCropComplete: (file: File) => void;
    onCancel: () => void;
}
const ImageCropperModal: React.FC<ImageCropperModalProps> = ({ imageUrl, onCropComplete, onCancel }) => {
    const imgRef = useRef<HTMLImageElement>(null);
    const [crop, setCrop] = useState<CropType>({ unit: '%', width: 50, aspect: IMAGE_ASPECT_RATIO });
    const [completedCrop, setCompletedCrop] = useState<PixelCrop | null>(null);
    const [isCropping, setIsCropping] = useState(false);
    const handleCrop = async () => {
        if (!completedCrop || !imgRef.current) return;
        setIsCropping(true);
        try {
            const croppedFile = await getCroppedImage(imgRef.current, completedCrop);
            onCropComplete(croppedFile);
        } catch (error) {
            console.error("Cropping failed:", error);
        } finally {
            setIsCropping(false);
        }
    };
  
    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
            <div className="bg-gray-800 rounded-2xl shadow-2xl max-w-xl w-full p-6 border border-gray-700">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold text-gray-100">Crop Image</h3>
                    <button onClick={onCancel}><X className="text-gray-500 hover:text-red-400" /></button>
                </div>
                <div className="max-h-[60vh] overflow-auto bg-gray-700 rounded-lg">
                    <ReactCrop crop={crop} onChange={c => setCrop(c)} onComplete={c => setCompletedCrop(c)} aspect={IMAGE_ASPECT_RATIO} circularCrop>
                        <img ref={imgRef} src={imageUrl} onLoad={(e) => setCrop({ unit: '%', width: 80, x: 10, y: 10, aspect: 1, height: 80 })} />
                    </ReactCrop>
                </div>
                <div className="mt-6 flex justify-end gap-3">
                    <button onClick={onCancel} className="px-4 py-2 text-gray-400 font-bold hover:bg-gray-700 rounded-lg">Cancel</button>
                    <button onClick={handleCrop} disabled={isCropping} className="px-6 py-2 bg-red-800 text-gray-300 font-bold rounded-lg hover:bg-red-900">
                        {isCropping ? 'Processing...' : 'Apply Crop'}
                    </button>
                </div>
            </div>
        </div>
    );
};