import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import api from '../utils/api';
import SkeletonLoading from './SkeletonLoading'
import {
    Button,
    Container,
    IconButton,
    InputAdornment,
    TextField,
    Typography,
    Grid,
    Card,
    CardContent,
    CardMedia,
    CardActions,
    CardActionArea,
    Collapse,
    Box,
    Snackbar,
    Alert,
    Chip
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import { useAuth } from '../AuthContext';
import PersonIcon from '@mui/icons-material/Person';

const omdbApiKey = process.env.REACT_APP_OMDB_KEY;
const tmdbApiKey = process.env.REACT_APP_TMDB_KEY;
const api_url = process.env.REACT_APP_API_URL;

const MovieSearch = () => {
    const { isLoggedIn, accessToken } = useAuth();
    const [query, setQuery] = useState('');
    const [movies, setMovies] = useState([]);
    const [expanded, setExpanded] = useState({});
    const [snackbarOpen, setSnackbarOpen] = useState(false);
    const [snackbarMessage, setSnackbarMessage] = useState('');
    const [snackbarSeverity, setSnackbarSeverity] = useState('success');
    const [loading, setLoading] = useState(false);
    const searchBoxRef = useRef(null);
    const skeletonRef = useRef(null); // Add a ref for the skeleton
    const inputRef = useRef(null);

    const searchMovie = async () => {
        const trimmedQuery = query.trim();

        if (!trimmedQuery) return;

        setLoading(true);

        // Scroll to the skeleton when loading starts
        if (skeletonRef.current) {
            skeletonRef.current.scrollIntoView({ behavior: 'smooth' });
        }

        const options = {
            method: 'GET',
            url: 'https://www.omdbapi.com/',
            params: {
                apikey: omdbApiKey,
                s: trimmedQuery,
                type: 'movie',
            }
        };

        try {
            const response = await axios.request(options);
            if (response.data.Response === 'True') {
                const initialMovies = response.data.Search;
                const detailedMoviesPromises = initialMovies.map(movie =>
                    getMovieDetails(movie.imdbID)
                );
                const detailedMovies = await Promise.all(detailedMoviesPromises);

                const mergedMovies = initialMovies.map((movie, index) => {
                    return { ...movie, details: detailedMovies[index] };
                });

                setMovies(mergedMovies);
            } else {
                setMovies([]);
                setSnackbarMessage(`No se ha obtenido ningún resultado con "${trimmedQuery}"`);
                setSnackbarSeverity('warning');
                setSnackbarOpen(true);
            }
            inputRef.current.blur();
        } catch (error) {
            console.error('Error:', error);
        } finally {
            setLoading(false);
        }
    };

    const getMovieDetails = async (imdbID) => {
        const options = {
            method: 'GET',
            url: 'https://www.omdbapi.com/',
            params: {
                apikey: omdbApiKey,
                i: imdbID,
                plot: 'short',
                r: 'json'
            }
        };

        try {
            const response = await axios.request(options); // Use axios directly
            const movieDetails = response.data;
            const providers = await getStreamingProviders(imdbID);
            return { ...movieDetails, providers };
        } catch (error) {
            console.error('Error:', error);
            return null;
        }
    };

    const getStreamingProviders = async (imdbID) => {
        try {
            const findResponse = await axios.get(`https://api.themoviedb.org/3/find/${imdbID}`, {
                params: { api_key: tmdbApiKey, external_source: 'imdb_id' }
            });
            const tmdbMovieId = findResponse.data?.movie_results?.[0]?.id;
            if (!tmdbMovieId) {
                return [];
            }

            const providersResponse = await axios.get(`https://api.themoviedb.org/3/movie/${tmdbMovieId}/watch/providers`, {
                params: { api_key: tmdbApiKey }
            });
            return providersResponse.data.results?.ES?.flatrate || [];
        } catch (error) {
            return [];
        }
    };

    const handleKeyPress = (event) => {
        if (event.key === 'Enter') {
            searchMovie();
        }
    };

    const markAsProposal = async (movie) => {
        if (!isLoggedIn) {
            setSnackbarMessage('Debe iniciar sesión primero para proponer una película.');
            setSnackbarSeverity('warning');
            setSnackbarOpen(true);
            return;
        }
        if (!api_url) {
            setSnackbarMessage('La API no está configurada correctamente.');
            setSnackbarSeverity('error');
            setSnackbarOpen(true);
            return;
        }
        if (!movie.details) {
            setSnackbarMessage('No se pudieron cargar los detalles de la película.');
            setSnackbarSeverity('warning');
            setSnackbarOpen(true);
            return;
        }

        const providers = (movie.details.providers || []).map(provider => ({
            name: provider.provider_name,
            image_url: `https://image.tmdb.org/t/p/original${provider.logo_path}`
        }));

        const postData = {
            tittle: movie.Title,
            image: movie.Poster,
            description: movie.details ? movie.details.Plot : null,
            year: movie.details ? movie.details.Year : null,
            runtime: movie.details ? movie.details.Runtime : null,
            genres: movie.details ? handleGenres(movie.details.Genre) : null,
            director: movie.details ? movie.details.Director : null,
            actors: movie.details ? movie.details.Actors : null,
            imdb_rating: movie.details ? movie.details.imdbRating : null,
            imdb_votes: movie.details ? movie.details.imdbVotes : null,
            imdb_id: movie.details ? movie.details.imdbID : null,
            providers: providers
        };

        try {
            await api.post(`${api_url}/film-festival/films-to-watch/`, postData, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                }
            });
            setSnackbarMessage('Propuesta enviada con éxito.');
            setSnackbarSeverity('success');
            setSnackbarOpen(true);
            setMovies((currentMovies) => currentMovies.filter((currentMovie) => currentMovie.imdbID !== movie.imdbID));
        } catch (error) {
            console.error('Error posting data:', error);
            const statusCode = error.response?.status;
            setSnackbarMessage(statusCode === 409 ? 'Error: La película ya ha sido propuesta.' : 'Error al enviar la propuesta.');
            setSnackbarSeverity('error');
            setSnackbarOpen(true);
        }
    };

    const handleGenres = (genre) => {
        return genre.split(',').map(g => g.trim());
    }

    const handleExpandClick = (movieId) => {
        setExpanded(prevState => ({ ...prevState, [movieId]: !prevState[movieId] }));
    };

    useEffect(() => {
        if (movies.length > 0) {
            searchBoxRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [movies]);

    const formatVotes = (votes) => {
        if (!votes) return 'N/A';
        const numericVotes = parseInt(votes.replace(/,/g, ''), 10);
        if (numericVotes >= 1000000) {
            return (numericVotes / 1000000).toFixed(1).replace('.', ',') + ' M';
        } else if (numericVotes >= 1000) {
            return (numericVotes / 1000).toFixed(1).replace('.', ',') + ' mil';
        }
        return numericVotes.toString();
    };

    return (
        <Container sx={{ px: 0.5 }}>
            <Typography variant="h4" component="h1" gutterBottom>
                Busca tu propuesta
            </Typography>
            <Box ref={searchBoxRef} sx={{ backgroundColor: 'white', padding: 2, borderRadius: 1, mb: 3 }}>
                <TextField
                    inputRef={inputRef}
                    label="Enter movie title"
                    variant="outlined"
                    fullWidth
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyPress={handleKeyPress}
                    InputProps={{
                        endAdornment: (
                            <InputAdornment position="end">
                                <IconButton onClick={searchMovie}>
                                    <SearchIcon />
                                </IconButton>
                            </InputAdornment>
                        ),
                    }}
                />
            </Box>
            {loading ? (
                <div ref={skeletonRef}>
                    <SkeletonLoading />
                </div>
            ) : (
                <>
                    {movies.length > 0 && (
                        <Typography variant="h5" component="h2" mb={3}>
                            Resultados de búsqueda
                        </Typography>
                    )}
                    <Grid container spacing={0.5} mb={2}>
                        {movies.map((movie) => (
                            <Grid item xs={6} sm={4} md={3} key={movie.imdbID}>
                                <Card>
                                    <CardActionArea sx={{ backgroundColor: '#e7f0fe' }} onClick={() => handleExpandClick(movie.imdbID)}>
                                        <Box sx={{ position: 'relative', paddingTop: '150%' }}>
                                            {movie.Poster !== 'N/A' && (
                                                <CardMedia
                                                    component="img"
                                                    image={movie.Poster}
                                                    alt={`${movie.Title} Poster`}
                                                    loading="lazy"
                                                    sx={{
                                                        position: 'absolute',
                                                        top: 0,
                                                        left: 0,
                                                        width: '100%',
                                                        height: '100%',
                                                        objectFit: 'cover'
                                                    }}
                                                />
                                            )}
                                        </Box>
                                        <CardContent sx={{ padding: 0, paddingTop: 1 }}>
                                            <Typography variant="h6">{movie.Title}</Typography>
                                            {movie.details && movie.details.imdbRating && (
                                                <Box sx={{ display: 'flex', alignItems: 'end', justifyContent: 'center' }}>
                                                    <Chip
                                                        sx={{ borderRadius: 2, color: 'white', fontSize: 20, fontWeight: 'bold', maxWidth: 100, backgroundColor: '#4682B4' }}
                                                        label={movie.details.imdbRating}
                                                    />
                                                    <Typography variant="subtitle1">
                                                        <PersonIcon sx={{ fontSize: 'medium' }} /> {formatVotes(movie.details.imdbVotes)}
                                                    </Typography>
                                                </Box>
                                            )}
                                            <Typography variant="body2" color="textSecondary">
                                                Año: {movie.Year}
                                            </Typography>
                                        </CardContent>
                                    </CardActionArea>
                                    {movie.details && (
                                        <Collapse sx={{ backgroundColor: '#e7f0fe' }} in={expanded[movie.imdbID]} timeout="auto" unmountOnExit>
                                            <CardContent>
                                                <Typography variant="body2" color="textSecondary" sx={{ textAlign: 'justify', mb: 1 }}>
                                                    {movie.details.Plot}
                                                </Typography>
                                                {movie.details.Genre && (
                                                    <Typography variant="body2" color="textSecondary" sx={{ textAlign: 'left', mb: 1 }}>
                                                        Genre: {movie.details.Genre}
                                                    </Typography>
                                                )}
                                                {movie.details.Director && (
                                                    <Typography variant="body2" color="textSecondary" sx={{ textAlign: 'left', mb: 1 }}>
                                                        Director: {movie.details.Director}
                                                    </Typography>
                                                )}
                                                {movie.details.Actors && (
                                                    <Typography variant="body2" color="textSecondary" sx={{ textAlign: 'left', mb: 1 }}>
                                                        Actors: {movie.details.Actors}
                                                    </Typography>
                                                )}
                                                {movie.details.Runtime && (
                                                    <Typography variant="body2" color="textSecondary" sx={{ textAlign: 'left', mb: 1 }}>
                                                        Runtime: {movie.details.Runtime}
                                                    </Typography>
                                                )}
                                                {movie.details.providers && movie.details.providers.length > 0 && (
                                                    <Box>
                                                        <Typography variant="body2" color="textSecondary" sx={{ textAlign: 'left', mb: 1 }}>
                                                            Available on:
                                                        </Typography>
                                                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.2 }}>
                                                            {movie.details.providers.map(provider => (
                                                                <img
                                                                    key={provider.provider_id}
                                                                    src={`https://image.tmdb.org/t/p/original${provider.logo_path}`}
                                                                    alt={provider.provider_name}
                                                                    style={{ width: 48, height: 48, borderRadius: 10 }}
                                                                />
                                                            ))}
                                                        </Box>
                                                    </Box>
                                                )}
                                            </CardContent>
                                        </Collapse>
                                    )}
                                    <CardActions sx={{ backgroundColor: '#e7f0fe' }}>
                                        <Button
                                            sx={{ backgroundColor: '#5CB6FF', borderRadius: 4 }}
                                            fullWidth
                                            variant="contained"
                                            onClick={() => markAsProposal(movie)}
                                        >
                                            PROPONER
                                        </Button>
                                    </CardActions>
                                </Card>
                            </Grid>
                        ))}
                    </Grid>
                </>
            )}
            <Snackbar
                open={snackbarOpen}
                autoHideDuration={6000}
                onClose={() => setSnackbarOpen(false)}
                anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
            >
                <Alert onClose={() => setSnackbarOpen(false)} severity={snackbarSeverity} sx={{ width: '100%' }}>
                    {snackbarMessage}
                </Alert>
            </Snackbar>
        </Container>
    );
};

export default MovieSearch;
